import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";
import SubjectsDatastore from "../datastores/subjects_datastore.ts";
import ProgressDatastore from "../datastores/progress_datastore.ts";

export const CloseSemesterFunction = DefineFunction({
  callback_id: "close_semester_function",
  title: "Close Semester",
  description: "学期を終了する",
  source_file: "./functions/close_semester_function.ts",
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
      final_report_msg: {
        type: Schema.types.string,
      },
    },
    required: ["final_report_msg"],
  },
});

/** Round to 1 decimal place */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function renderBar(pct: number, total = 10): string {
  const filled = Math.round((pct / 100) * total);
  const empty = total - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export default SlackFunction(
  CloseSemesterFunction,
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
          "終了できるアクティブな学期がありません。",
      };
    }

    const semester = semesterRes.items[0];

    // 確認モーダルを開く
    const openRes = await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: {
        type: "modal",
        callback_id: "close_semester_modal",
        private_metadata: JSON.stringify({
          semester_id: semester.semester_id,
          year: semester.year,
          season: semester.season,
          end_date: semester.end_date,
        }),
        title: { type: "plain_text", text: "学期を終了する" },
        submit: { type: "plain_text", text: "終了する" },
        close: { type: "plain_text", text: "キャンセル" },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `*${semester.year}年 ${semester.season}学期* を終了しますか？\n\n⚠️ この操作は取り消せません。`,
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
  "close_semester_modal",
  async ({ view, client, body }) => {
    const metadata = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // 全科目を取得
    const subjectsRes = await client.apps.datastore.query<
      typeof SubjectsDatastore.definition
    >({
      datastore: SubjectsDatastore.definition.name,
      expression: "semester_id = :sid",
      expression_values: { ":sid": metadata.semester_id },
    });

    // 全進捗を取得
    const progressRes = await client.apps.datastore.query<
      typeof ProgressDatastore.definition
    >({
      datastore: ProgressDatastore.definition.name,
      expression: "user_id = :uid",
      expression_values: { ":uid": userId },
    });

    const progressMap = new Map(
      (progressRes.items ?? []).map((p) => [p.subject_id, p.progress_pct]),
    );

    const subjects = subjectsRes.items ?? [];
    const enriched = subjects.map((s) => {
      const pct = progressMap.get(s.subject_id);
      return {
        subject_name: s.subject_name,
        credits: s.credits,
        progress_pct: pct ?? 0,
        has_progress: pct !== undefined,
      };
    });

    // 加重平均を計算
    const totalCredits = enriched.reduce((sum, s) => sum + s.credits, 0);
    const weightedProgress = totalCredits > 0
      ? round1(
        enriched.reduce((sum, s) => sum + s.credits * s.progress_pct, 0) /
          totalCredits,
      )
      : 0;

    // 学期を終了状態に更新
    const closedAt = new Date().toISOString();
    await client.apps.datastore.put<typeof SemestersDatastore.definition>({
      datastore: SemestersDatastore.definition.name,
      item: {
        semester_id: metadata.semester_id,
        user_id: userId,
        year: metadata.year,
        season: metadata.season,
        start_date: "",
        end_date: metadata.end_date,
        status: "closed",
        created_at: "",
        closed_at: closedAt,
      },
    });

    const subjectLines = enriched.map((s) => {
      const bar = renderBar(s.progress_pct);
      const pctLabel = s.has_progress ? `${s.progress_pct}%` : "N/A";
      return `  ${s.subject_name} (${s.credits}単位)  ${bar}  ${pctLabel}`;
    }).join("\n");

    const finalStatus = weightedProgress >= 80
      ? "✅ よく頑張りました！"
      : weightedProgress >= 60
      ? "👍 お疲れ様でした！"
      : "📝 お疲れ様でした。次学期も頑張りましょう！";

    const closedDateLabel = new Date(closedAt).toLocaleDateString("ja-JP");
    const final_report_msg =
      `🎓 ${metadata.year}年 ${metadata.season}学期 — 最終レポート\n\n` +
      (enriched.length > 0
        ? `科目別最終進捗:\n${subjectLines}\n\n`
        : "（科目の登録なし）\n\n") +
      `最終加重平均: ${weightedProgress}% ${renderBar(weightedProgress)}\n` +
      `学期終了日: ${closedDateLabel}\n\n` +
      finalStatus;

    await client.functions.completeSuccess({
      function_execution_id: body.function_data.execution_id,
      outputs: { final_report_msg },
    });

    return { response_action: "clear" as const };
  },
);
