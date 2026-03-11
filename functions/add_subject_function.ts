import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";
import SubjectsDatastore from "../datastores/subjects_datastore.ts";

export const AddSubjectFunction = DefineFunction({
  callback_id: "add_subject_function",
  title: "Add Subject",
  description: "アクティブな学期に科目を追加する",
  source_file: "./functions/add_subject_function.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      user_id: {
        type: Schema.slack.types.user_id,
      },
    },
    required: ["interactivity", "user_id"],
  },
  output_parameters: {
    properties: {
      confirmation_msg: {
        type: Schema.types.string,
      },
    },
    required: ["confirmation_msg"],
  },
});

interface AddedSubject {
  name: string;
  credits: number;
}

interface ModalMetadata {
  semester_id: string;
  semester_year: number;
  semester_season: string;
  added_subjects: AddedSubject[];
  form_seq: number;
}

function buildModalView(metadata: ModalMetadata) {
  const { semester_year, semester_season, added_subjects, form_seq } = metadata;
  const seq = form_seq ?? 0;

  const blocks: Record<string, unknown>[] = [];

  // 登録済み科目一覧
  if (added_subjects.length > 0) {
    const list = added_subjects
      .map((s, i) => `${i + 1}. ${s.name}（${s.credits}単位）`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${semester_year}年 ${semester_season}学期*\n\n` +
          `*登録済み（${added_subjects.length}科目）:*\n${list}`,
      },
    });
    blocks.push({ type: "divider" });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${semester_year}年 ${semester_season}学期* に科目を追加します`,
      },
    });
  }

  // 入力欄（block_id にシーケンス番号を付けて毎回リセット）
  blocks.push({
    type: "input",
    block_id: `subject_name_block_${seq}`,
    label: { type: "plain_text", text: "科目名" },
    element: {
      type: "plain_text_input",
      action_id: "subject_name_input",
      placeholder: { type: "plain_text", text: "科目名を入力..." },
    },
  });
  blocks.push({
    type: "input",
    block_id: `credits_block_${seq}`,
    label: { type: "plain_text", text: "単位数" },
    element: {
      type: "static_select",
      action_id: "credits_select",
      options: [
        { text: { type: "plain_text", text: "1単位" }, value: "1" },
        { text: { type: "plain_text", text: "2単位" }, value: "2" },
      ],
    },
  });

  return {
    type: "modal" as const,
    callback_id: "add_subject_modal",
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: { type: "plain_text" as const, text: "科目を追加する" },
    submit: { type: "plain_text" as const, text: "追加" },
    close: { type: "plain_text" as const, text: "完了" },
    blocks,
  };
}

export default SlackFunction(
  AddSubjectFunction,
  async ({ inputs, client }) => {
    // アクティブ学期を取得
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

    const metadata: ModalMetadata = {
      semester_id: semester.semester_id,
      semester_year: semester.year,
      semester_season: semester.season,
      added_subjects: [],
      form_seq: 0,
    };

    const openRes = await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: buildModalView(metadata),
    });

    if (!openRes.ok) {
      return { error: `モーダルを開けませんでした: ${openRes.error}` };
    }

    return { completed: false };
  },
).addViewSubmissionHandler(
  "add_subject_modal",
  async ({ view, client, body }) => {
    const metadata: ModalMetadata = JSON.parse(view.private_metadata);
    const seq = metadata.form_seq ?? 0;
    const values = view.state.values;
    const subjectName =
      values[`subject_name_block_${seq}`].subject_name_input.value!.trim();
    const credits = Number(
      values[`credits_block_${seq}`].credits_select.selected_option!.value,
    );
    const userId = body.user.id;

    if (subjectName.length === 0) {
      return {
        response_action: "errors" as const,
        errors: { [`subject_name_block_${seq}`]: "科目名を入力してください。" },
      };
    }

    // 重複チェック
    const dupRes = await client.apps.datastore.query<
      typeof SubjectsDatastore.definition
    >({
      datastore: SubjectsDatastore.definition.name,
      expression: "semester_id = :sid AND subject_name = :name",
      expression_values: {
        ":sid": metadata.semester_id,
        ":name": subjectName,
      },
    });

    if (dupRes.ok && dupRes.items.length > 0) {
      return {
        response_action: "errors" as const,
        errors: {
          [`subject_name_block_${seq}`]: `科目「${subjectName}」はすでに登録されています。`,
        },
      };
    }

    const subjectId = crypto.randomUUID();
    const putRes = await client.apps.datastore.put<
      typeof SubjectsDatastore.definition
    >({
      datastore: SubjectsDatastore.definition.name,
      item: {
        subject_id: subjectId,
        semester_id: metadata.semester_id,
        user_id: userId,
        subject_name: subjectName,
        credits,
      },
    });

    if (!putRes.ok) {
      return {
        response_action: "errors" as const,
        errors: { [`subject_name_block_${seq}`]: `保存に失敗しました: ${putRes.error}` },
      };
    }

    // 登録済みリストに追加し、シーケンス番号を進めてモーダルを更新
    metadata.added_subjects.push({ name: subjectName, credits });
    metadata.form_seq = seq + 1;

    return {
      response_action: "update" as const,
      view: buildModalView(metadata),
    };
  },
).addViewClosedHandler(
  "add_subject_modal",
  async ({ view, body, client }) => {
    const metadata: ModalMetadata = JSON.parse(view.private_metadata);
    const added = metadata.added_subjects;

    let confirmation_msg: string;
    if (added.length === 0) {
      confirmation_msg = "科目の追加はキャンセルされました。";
    } else {
      const list = added
        .map((s) => `• ${s.name}（${s.credits}単位）`)
        .join("\n");
      confirmation_msg =
        `✅ ${added.length}科目を追加しました！\n\n` +
        `📅 ${metadata.semester_year}年 ${metadata.semester_season}学期\n` +
        list;
    }

    await client.functions.completeSuccess({
      function_execution_id: body.function_data.execution_id,
      outputs: { confirmation_msg },
    });
  },
);
