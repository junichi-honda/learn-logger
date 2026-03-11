import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";

export const CreateSemesterFunction = DefineFunction({
  callback_id: "create_semester_function",
  title: "Create Semester",
  description: "学期を作成する",
  source_file: "./functions/create_semester_function.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      user_id: {
        type: Schema.slack.types.user_id,
      },
      channel: {
        type: Schema.slack.types.channel_id,
      },
    },
    required: ["interactivity", "user_id", "channel"],
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

export default SlackFunction(
  CreateSemesterFunction,
  async ({ inputs, client }) => {
    const openRes = await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: {
        type: "modal",
        callback_id: "create_semester_modal",
        private_metadata: JSON.stringify({ channel: inputs.channel }),
        title: { type: "plain_text", text: "学期を登録する" },
        submit: { type: "plain_text", text: "登録" },
        close: { type: "plain_text", text: "キャンセル" },
        blocks: [
          {
            type: "input",
            block_id: "year_block",
            label: { type: "plain_text", text: "年度 (例: 2025)" },
            element: {
              type: "number_input",
              action_id: "year_input",
              is_decimal_allowed: false,
              placeholder: { type: "plain_text", text: "2025" },
            },
          },
          {
            type: "input",
            block_id: "season_block",
            label: { type: "plain_text", text: "学期" },
            element: {
              type: "static_select",
              action_id: "season_select",
              options: [
                {
                  text: { type: "plain_text", text: "春学期" },
                  value: "春",
                },
                {
                  text: { type: "plain_text", text: "秋学期" },
                  value: "秋",
                },
              ],
            },
          },
          {
            type: "input",
            block_id: "start_date_block",
            label: { type: "plain_text", text: "開始日" },
            element: {
              type: "datepicker",
              action_id: "start_date_picker",
            },
          },
          {
            type: "input",
            block_id: "end_date_block",
            label: { type: "plain_text", text: "終了日" },
            element: {
              type: "datepicker",
              action_id: "end_date_picker",
            },
          },
        ],
      },
    });

    if (!openRes.ok) {
      return { error: `モーダルを開けませんでした: ${openRes.error}` };
    }

    return { completed: false };
  },
).addViewSubmissionHandler(
  "create_semester_modal",
  async ({ view, client, body }) => {
    const values = view.state.values;
    const year = Number(values.year_block.year_input.value);
    const season =
      values.season_block.season_select.selected_option!.value;
    const startDate =
      values.start_date_block.start_date_picker.selected_date!;
    const endDate =
      values.end_date_block.end_date_picker.selected_date!;
    const userId = body.user.id;

    // バリデーション
    const errors: Record<string, string> = {};

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      errors.year_block = "2000〜2100の4桁の西暦で入力してください。";
    }

    if (startDate >= endDate) {
      errors.end_date_block = "終了日は開始日より後の日付を指定してください。";
    }

    if (Object.keys(errors).length > 0) {
      return { response_action: "errors" as const, errors };
    }

    // 既存のアクティブ学期を確認
    const existingRes = await client.apps.datastore.query<
      typeof SemestersDatastore.definition
    >({
      datastore: SemestersDatastore.definition.name,
      expression: "user_id = :uid AND #s = :active",
      expression_attributes: { "#s": "status" },
      expression_values: {
        ":uid": userId,
        ":active": "active",
      },
    });

    let warningMsg = "";
    if (existingRes.ok && existingRes.items.length > 0) {
      const existing = existingRes.items[0];
      warningMsg =
        `\n⚠️ 既存のアクティブ学期（${existing.year}年 ${existing.season}学期）があります。`;
    }

    const semesterId = crypto.randomUUID();
    const putRes = await client.apps.datastore.put<
      typeof SemestersDatastore.definition
    >({
      datastore: SemestersDatastore.definition.name,
      item: {
        semester_id: semesterId,
        user_id: userId,
        year,
        season,
        start_date: startDate,
        end_date: endDate,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: "",
      },
    });

    if (!putRes.ok) {
      return {
        response_action: "errors" as const,
        errors: { year_block: `保存に失敗しました: ${putRes.error}` },
      };
    }

    const confirmation_msg =
      `✅ 学期を作成しました！${warningMsg}\n\n` +
      `📅 ${year}年 ${season}学期\n` +
      `• 開始日: ${startDate}\n` +
      `• 終了日: ${endDate}\n\n` +
      `次に「科目を追加する」ショートカットで科目を登録してください。`;

    await client.functions.completeSuccess({
      function_execution_id: body.function_data.execution_id,
      outputs: { confirmation_msg },
    });

    return { response_action: "clear" as const };
  },
);
