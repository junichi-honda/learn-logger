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
      user_id: {
        type: Schema.slack.types.user_id,
      },
      subject_name: {
        type: Schema.types.string,
      },
      credits: {
        type: Schema.types.number,
      },
    },
    required: ["user_id", "subject_name", "credits"],
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
  AddSubjectFunction,
  async ({ inputs, client }) => {
    // アクティブ学期を取得
    const semesterRes = await client.apps.datastore.query<
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

    if (!semesterRes.ok || semesterRes.items.length === 0) {
      return {
        error:
          "アクティブな学期がありません。先に「学期を作成する」ショートカットで学期を登録してください。",
      };
    }

    const semester = semesterRes.items[0];

    // 重複チェック
    const dupRes = await client.apps.datastore.query<
      typeof SubjectsDatastore.definition
    >({
      datastore: SubjectsDatastore.definition.name,
      expression: "semester_id = :sid AND subject_name = :name",
      expression_attributes: {
        ":sid": semester.semester_id,
        ":name": inputs.subject_name,
      },
    });

    if (dupRes.ok && dupRes.items.length > 0) {
      return {
        error:
          `科目「${inputs.subject_name}」はすでに登録されています。`,
      };
    }

    const subjectId = crypto.randomUUID();
    const putRes = await client.apps.datastore.put<
      typeof SubjectsDatastore.definition
    >({
      datastore: SubjectsDatastore.definition.name,
      item: {
        subject_id: subjectId,
        semester_id: semester.semester_id,
        user_id: inputs.user_id,
        subject_name: inputs.subject_name,
        credits: inputs.credits,
      },
    });

    if (!putRes.ok) {
      return { error: `科目の追加に失敗しました: ${putRes.error}` };
    }

    const confirmation_msg =
      `✅ 科目を追加しました！\n\n` +
      `📅 ${semester.year}年 ${semester.season}学期\n` +
      `• 科目名: ${inputs.subject_name}\n` +
      `• 単位数: ${inputs.credits}単位`;

    return { outputs: { confirmation_msg } };
  },
);
