import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";
import SubjectsDatastore from "../datastores/subjects_datastore.ts";

export const ManageSubjectFunction = DefineFunction({
  callback_id: "manage_subject_function",
  title: "Manage Subjects",
  description: "科目の編集・削除を行う",
  source_file: "./functions/manage_subject_function.ts",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "user_id"],
  },
  output_parameters: {
    properties: {
      result_msg: { type: Schema.types.string },
    },
    required: ["result_msg"],
  },
});

interface SubjectItem {
  subject_id: string;
  subject_name: string;
  credits: number;
}

interface ModalMetadata {
  semester_id: string;
  semester_year: number;
  semester_season: string;
  mode: "list" | "edit";
  editing_subject?: SubjectItem;
  form_seq: number;
}

async function querySubjects(
  client: { apps: { datastore: { query: Function } } },
  semesterId: string,
): Promise<SubjectItem[]> {
  const res = await client.apps.datastore.query<
    typeof SubjectsDatastore.definition
  >({
    datastore: SubjectsDatastore.definition.name,
    expression: "semester_id = :sid",
    expression_values: { ":sid": semesterId },
  });
  return (res.items ?? []).map((s: Record<string, unknown>) => ({
    subject_id: s.subject_id as string,
    subject_name: s.subject_name as string,
    credits: s.credits as number,
  }));
}

function buildListView(
  metadata: ModalMetadata,
  subjects: SubjectItem[],
) {
  const { semester_year, semester_season, form_seq } = metadata;
  const blocks: Record<string, unknown>[] = [];

  if (subjects.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${semester_year}年 ${semester_season}学期*\n\n登録されている科目がありません。`,
      },
    });
    return {
      type: "modal" as const,
      callback_id: "manage_subject_modal",
      notify_on_close: true,
      private_metadata: JSON.stringify(metadata),
      title: { type: "plain_text" as const, text: "科目を管理する" },
      close: { type: "plain_text" as const, text: "閉じる" },
      blocks,
    };
  }

  const list = subjects
    .map((s) => `• ${s.subject_name}（${s.credits}単位）`)
    .join("\n");
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        `*${semester_year}年 ${semester_season}学期*\n\n` +
        `*登録済み（${subjects.length}科目）:*\n${list}`,
    },
  });
  blocks.push({ type: "divider" });

  blocks.push({
    type: "input",
    block_id: `subject_select_block_${form_seq}`,
    label: { type: "plain_text", text: "科目を選択" },
    element: {
      type: "static_select",
      action_id: "subject_select",
      placeholder: { type: "plain_text", text: "科目を選択..." },
      options: subjects.map((s) => ({
        text: {
          type: "plain_text" as const,
          text: `${s.subject_name}（${s.credits}単位）`,
        },
        value: JSON.stringify(s),
      })),
    },
  });

  blocks.push({
    type: "input",
    block_id: `action_block_${form_seq}`,
    label: { type: "plain_text", text: "操作" },
    element: {
      type: "radio_buttons",
      action_id: "action_select",
      options: [
        {
          text: { type: "plain_text", text: "編集" },
          value: "edit",
        },
        {
          text: { type: "plain_text", text: "削除" },
          value: "delete",
        },
      ],
    },
  });

  return {
    type: "modal" as const,
    callback_id: "manage_subject_modal",
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: { type: "plain_text" as const, text: "科目を管理する" },
    submit: { type: "plain_text" as const, text: "実行" },
    close: { type: "plain_text" as const, text: "閉じる" },
    blocks,
  };
}

function buildEditView(metadata: ModalMetadata) {
  const { editing_subject, form_seq } = metadata;
  if (!editing_subject) throw new Error("No subject to edit");

  const blocks: Record<string, unknown>[] = [
    {
      type: "input",
      block_id: `edit_name_block_${form_seq}`,
      label: { type: "plain_text", text: "科目名" },
      element: {
        type: "plain_text_input",
        action_id: "edit_name_input",
        initial_value: editing_subject.subject_name,
      },
    },
    {
      type: "input",
      block_id: `edit_credits_block_${form_seq}`,
      label: { type: "plain_text", text: "単位数" },
      element: {
        type: "static_select",
        action_id: "edit_credits_select",
        initial_option: {
          text: {
            type: "plain_text",
            text: `${editing_subject.credits}単位`,
          },
          value: String(editing_subject.credits),
        },
        options: [
          { text: { type: "plain_text", text: "1単位" }, value: "1" },
          { text: { type: "plain_text", text: "2単位" }, value: "2" },
        ],
      },
    },
  ];

  return {
    type: "modal" as const,
    callback_id: "manage_subject_modal",
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: { type: "plain_text" as const, text: "科目を編集する" },
    submit: { type: "plain_text" as const, text: "保存" },
    close: { type: "plain_text" as const, text: "戻る" },
    blocks,
  };
}

export default SlackFunction(
  ManageSubjectFunction,
  async ({ inputs, client }) => {
    const semesterRes = await client.apps.datastore.query<
      typeof SemestersDatastore.definition
    >({
      datastore: SemestersDatastore.definition.name,
      expression: "user_id = :uid AND #s = :active",
      expression_attributes: { "#s": "status" },
      expression_values: {
        ":uid": inputs.user_id,
        ":active": "active",
      },
    });

    if (!semesterRes.ok || semesterRes.items.length === 0) {
      return {
        error:
          "アクティブな学期がありません。先に「学期を作成する」ショートカットで学期を登録してください。",
      };
    }

    const semester = semesterRes.items[0];
    const subjects = await querySubjects(client, semester.semester_id);

    const metadata: ModalMetadata = {
      semester_id: semester.semester_id,
      semester_year: semester.year,
      semester_season: semester.season,
      mode: "list",
      form_seq: 0,
    };

    const openRes = await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: buildListView(metadata, subjects),
    });

    if (!openRes.ok) {
      return { error: `モーダルを開けませんでした: ${openRes.error}` };
    }

    return { completed: false };
  },
).addViewSubmissionHandler(
  "manage_subject_modal",
  async ({ view, client, body }) => {
    const metadata: ModalMetadata = JSON.parse(view.private_metadata);
    const seq = metadata.form_seq;
    const userId = body.user.id;

    if (metadata.mode === "list") {
      // 一覧モードからの送信
      const values = view.state.values;
      const selectedSubject: SubjectItem = JSON.parse(
        values[`subject_select_block_${seq}`].subject_select.selected_option!
          .value,
      );
      const action =
        values[`action_block_${seq}`].action_select.selected_option!.value;

      if (action === "delete") {
        // 科目を削除
        const delRes = await client.apps.datastore.delete<
          typeof SubjectsDatastore.definition
        >({
          datastore: SubjectsDatastore.definition.name,
          id: selectedSubject.subject_id,
        });

        if (!delRes.ok) {
          return {
            response_action: "errors" as const,
            errors: {
              [`subject_select_block_${seq}`]:
                `削除に失敗しました: ${delRes.error}`,
            },
          };
        }

        // 一覧を更新して再表示
        const subjects = await querySubjects(client, metadata.semester_id);
        metadata.form_seq = seq + 1;
        metadata.mode = "list";

        if (subjects.length === 0) {
          // 科目がなくなった場合は完了
          await client.functions.completeSuccess({
            function_execution_id: body.function_data.execution_id,
            outputs: {
              result_msg:
                `🗑️ 科目「${selectedSubject.subject_name}」を削除しました。\n登録科目がなくなりました。`,
            },
          });
          return { response_action: "clear" as const };
        }

        return {
          response_action: "update" as const,
          view: buildListView(metadata, subjects),
        };
      }

      if (action === "edit") {
        // 編集モードに切り替え
        metadata.mode = "edit";
        metadata.editing_subject = selectedSubject;
        metadata.form_seq = seq + 1;
        return {
          response_action: "update" as const,
          view: buildEditView(metadata),
        };
      }
    }

    if (metadata.mode === "edit" && metadata.editing_subject) {
      // 編集モードからの送信
      const values = view.state.values;
      const newName =
        values[`edit_name_block_${seq}`].edit_name_input.value!.trim();
      const newCredits = Number(
        values[`edit_credits_block_${seq}`].edit_credits_select
          .selected_option!.value,
      );

      if (newName.length === 0) {
        return {
          response_action: "errors" as const,
          errors: {
            [`edit_name_block_${seq}`]: "科目名を入力してください。",
          },
        };
      }

      // 科目を更新
      const putRes = await client.apps.datastore.put<
        typeof SubjectsDatastore.definition
      >({
        datastore: SubjectsDatastore.definition.name,
        item: {
          subject_id: metadata.editing_subject.subject_id,
          semester_id: metadata.semester_id,
          user_id: userId,
          subject_name: newName,
          credits: newCredits,
        },
      });

      if (!putRes.ok) {
        return {
          response_action: "errors" as const,
          errors: {
            [`edit_name_block_${seq}`]: `保存に失敗しました: ${putRes.error}`,
          },
        };
      }

      // 一覧に戻る
      const subjects = await querySubjects(client, metadata.semester_id);
      metadata.mode = "list";
      metadata.editing_subject = undefined;
      metadata.form_seq = seq + 1;

      return {
        response_action: "update" as const,
        view: buildListView(metadata, subjects),
      };
    }

    return { response_action: "clear" as const };
  },
).addViewClosedHandler(
  "manage_subject_modal",
  async ({ view, body, client }) => {
    const metadata: ModalMetadata = JSON.parse(view.private_metadata);

    // 編集モードで「戻る」を押した場合はモーダルが閉じるので完了扱い
    const result_msg =
      `📋 ${metadata.semester_year}年 ${metadata.semester_season}学期の科目管理を終了しました。`;

    await client.functions.completeSuccess({
      function_execution_id: body.function_data.execution_id,
      outputs: { result_msg },
    });
  },
);
