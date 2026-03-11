import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";

export const CreateSemesterFunction = DefineFunction({
  callback_id: "create_semester_function",
  title: "Create Semester",
  description: "学期を作成する",
  source_file: "./functions/create_semester_function.ts",
  input_parameters: {
    properties: {
      user_id: {
        type: Schema.slack.types.user_id,
      },
      year: {
        type: Schema.types.number,
      },
      season: {
        type: Schema.types.string,
      },
      start_date: {
        type: Schema.types.string,
      },
      end_date: {
        type: Schema.types.string,
      },
    },
    required: ["user_id", "year", "season", "start_date", "end_date"],
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
    // 既存のアクティブ学期を確認
    const existingRes = await client.apps.datastore.query<
      typeof SemestersDatastore.definition
    >({
      datastore: SemestersDatastore.definition.name,
      expression: "user_id = :uid AND #s = :active",
      expression_attributes: {
        ":uid": inputs.user_id,
        ":active": "active",
      },
      expression_attribute_names: { "#s": "status" },
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
        user_id: inputs.user_id,
        year: inputs.year,
        season: inputs.season,
        start_date: inputs.start_date,
        end_date: inputs.end_date,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: "",
      },
    });

    if (!putRes.ok) {
      return { error: `学期の作成に失敗しました: ${putRes.error}` };
    }

    const confirmation_msg =
      `✅ 学期を作成しました！${warningMsg}\n\n` +
      `📅 ${inputs.year}年 ${inputs.season}学期\n` +
      `• 開始日: ${inputs.start_date}\n` +
      `• 終了日: ${inputs.end_date}\n\n` +
      `次に「科目を追加する」ショートカットで科目を登録してください。`;

    return { outputs: { confirmation_msg } };
  },
);
