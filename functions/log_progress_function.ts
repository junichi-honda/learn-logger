import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";
import SubjectsDatastore from "../datastores/subjects_datastore.ts";
import ProgressDatastore from "../datastores/progress_datastore.ts";

export const LogProgressFunction = DefineFunction({
  callback_id: "log_progress_function",
  title: "Log Progress",
  description: "学習進捗を記録する",
  source_file: "./functions/log_progress_function.ts",
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
      report_msg: {
        type: Schema.types.string,
      },
    },
    required: ["report_msg"],
  },
});

/** Round to 1 decimal place */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Return today's date in JST (without time) */
function getJstToday(): Date {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const day = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(year, month, day);
}

function msToDays(ms: number): number {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function calcElapsedRate(semStart: string, semEnd: string): number {
  const start = new Date(semStart + "T00:00:00+09:00");
  const end = new Date(semEnd + "T00:00:00+09:00");
  const today = getJstToday();
  const total = msToDays(end.getTime() - start.getTime());
  const elapsed = Math.max(0, msToDays(today.getTime() - start.getTime()));
  if (total <= 0) return 100;
  return round1(Math.min(100, (elapsed / total) * 100));
}

function renderBar(pct: number, total = 10): string {
  const filled = Math.round((pct / 100) * total);
  const empty = total - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export default SlackFunction(
  LogProgressFunction,
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

    // 科目一覧を取得
    const subjectsRes = await client.apps.datastore.query<
      typeof SubjectsDatastore.definition
    >({
      datastore: SubjectsDatastore.definition.name,
      expression: "semester_id = :sid",
      expression_values: { ":sid": semester.semester_id },
    });

    if (!subjectsRes.ok || subjectsRes.items.length === 0) {
      return {
        error:
          "登録されている科目がありません。先に「科目を追加する」ショートカットで科目を登録してください。",
      };
    }

    const subjects = subjectsRes.items;

    // モーダルを開く
    const openRes = await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: {
        type: "modal",
        callback_id: "log_progress_modal",
        private_metadata: JSON.stringify({
          semester_id: semester.semester_id,
          semester_year: semester.year,
          semester_season: semester.season,
          semester_start: semester.start_date,
          semester_end: semester.end_date,
        }),
        title: { type: "plain_text", text: "進捗を記録する" },
        submit: { type: "plain_text", text: "記録" },
        close: { type: "plain_text", text: "キャンセル" },
        blocks: [
          {
            type: "input",
            block_id: "subject_block",
            label: { type: "plain_text", text: "科目" },
            element: {
              type: "static_select",
              action_id: "subject_select",
              placeholder: { type: "plain_text", text: "科目を選択..." },
              options: subjects.map((s) => ({
                text: {
                  type: "plain_text" as const,
                  text: `${s.subject_name} (${s.credits}単位)`,
                },
                value: JSON.stringify({
                  subject_id: s.subject_id,
                  subject_name: s.subject_name,
                  credits: s.credits,
                }),
              })),
            },
          },
          {
            type: "input",
            block_id: "progress_block",
            label: { type: "plain_text", text: "進捗率 (%)" },
            element: {
              type: "number_input",
              action_id: "progress_input",
              is_decimal_allowed: false,
              min_value: "0",
              max_value: "100",
              placeholder: { type: "plain_text", text: "0〜100" },
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
  "log_progress_modal",
  async ({ view, client, body }) => {
    const subjectValue = JSON.parse(
      view.state.values.subject_block.subject_select.selected_option!.value,
    );
    const progressPct = Number(
      view.state.values.progress_block.progress_input.value,
    );
    const metadata = JSON.parse(view.private_metadata);
    const userId = body.user.id;

    // 進捗をアップサート
    const putRes = await client.apps.datastore.put<
      typeof ProgressDatastore.definition
    >({
      datastore: ProgressDatastore.definition.name,
      item: {
        subject_id: subjectValue.subject_id,
        user_id: userId,
        progress_pct: progressPct,
        updated_at: new Date().toISOString(),
      },
    });

    if (!putRes.ok) {
      return {
        response_action: "errors" as const,
        errors: { subject_block: `保存に失敗しました: ${putRes.error}` },
      };
    }

    // 経過時間率を計算
    const elapsedRate = calcElapsedRate(
      metadata.semester_start,
      metadata.semester_end,
    );
    const diff = round1(progressPct - elapsedRate);
    const diffStr = diff > 0
      ? `+${diff}% ✅ 順調です！`
      : diff < 0
      ? `${diff}% ⚠️ 遅れています`
      : `±0% ✅ 予定通りです`;

    const today = getJstToday().toLocaleDateString("ja-JP");
    const report_msg =
      `✅ 進捗を記録しました（${today}）\n` +
      `📅 ${metadata.semester_year}年 ${metadata.semester_season}学期\n\n` +
      `*${subjectValue.subject_name}* (${subjectValue.credits}単位)\n` +
      `${renderBar(progressPct)}  ${progressPct}%\n\n` +
      `経過時間: ${elapsedRate}% ${renderBar(elapsedRate)}\n` +
      `差分: ${diffStr}`;

    await client.functions.completeSuccess({
      function_execution_id: body.function_data.execution_id,
      outputs: { report_msg },
    });

    return { response_action: "clear" as const };
  },
);
