import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";
import SubjectsDatastore from "../datastores/subjects_datastore.ts";
import ProgressDatastore from "../datastores/progress_datastore.ts";

export const ViewProgressFunction = DefineFunction({
  callback_id: "view_progress_function",
  title: "View Progress",
  description: "学期の全科目進捗を一覧表示する",
  source_file: "./functions/view_progress_function.ts",
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
      overview_msg: {
        type: Schema.types.string,
      },
    },
    required: ["overview_msg"],
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
  ViewProgressFunction,
  async ({ inputs, client }) => {
    // ユーザーの全学期を取得
    const semestersRes = await client.apps.datastore.query<
      typeof SemestersDatastore.definition
    >({
      datastore: SemestersDatastore.definition.name,
      expression: "user_id = :uid",
      expression_attributes: { ":uid": inputs.user_id },
    });

    if (!semestersRes.ok || semestersRes.items.length === 0) {
      return {
        error:
          "学期が登録されていません。先に「学期を作成する」ショートカットで学期を登録してください。",
      };
    }

    // 新しい順に並び替え
    const semesters = semestersRes.items.sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );

    // 学期選択モーダルを開く
    const openRes = await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: {
        type: "modal",
        callback_id: "view_progress_modal",
        title: { type: "plain_text", text: "進捗を確認する" },
        submit: { type: "plain_text", text: "表示" },
        close: { type: "plain_text", text: "キャンセル" },
        blocks: [
          {
            type: "input",
            block_id: "semester_block",
            label: { type: "plain_text", text: "学期を選択" },
            element: {
              type: "static_select",
              action_id: "semester_select",
              placeholder: { type: "plain_text", text: "学期を選択..." },
              options: semesters.map((s) => {
                const statusLabel = s.status === "active" ? "進行中" : "終了";
                return {
                  text: {
                    type: "plain_text" as const,
                    text: `${s.year}年 ${s.season}学期 [${statusLabel}]`,
                  },
                  value: JSON.stringify({
                    semester_id: s.semester_id,
                    year: s.year,
                    season: s.season,
                    start_date: s.start_date,
                    end_date: s.end_date,
                    status: s.status,
                  }),
                };
              }),
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
  "view_progress_modal",
  async ({ view, client, body }) => {
    const semesterValue = JSON.parse(
      view.state.values.semester_block.semester_select.selected_option!.value,
    );

    // 選択した学期の全科目を取得
    const subjectsRes = await client.apps.datastore.query<
      typeof SubjectsDatastore.definition
    >({
      datastore: SubjectsDatastore.definition.name,
      expression: "semester_id = :sid",
      expression_attributes: { ":sid": semesterValue.semester_id },
    });

    if (!subjectsRes.ok || subjectsRes.items.length === 0) {
      await client.functions.completeError({
        function_execution_id: body.function_data.execution_id,
        error: "この学期に科目が登録されていません。",
      });
      return { response_action: "clear" as const };
    }

    const subjects = subjectsRes.items;

    // 全進捗を取得
    const progressRes = await client.apps.datastore.query<
      typeof ProgressDatastore.definition
    >({
      datastore: ProgressDatastore.definition.name,
      expression: "user_id = :uid",
      expression_attributes: { ":uid": body.user.id },
    });

    const progressMap = new Map(
      (progressRes.items ?? []).map((p) => [p.subject_id, p.progress_pct]),
    );

    // メモリ内結合
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

    // 経過率（終了済み学期は100%固定）
    const elapsedRate = semesterValue.status === "closed"
      ? 100
      : calcElapsedRate(semesterValue.start_date, semesterValue.end_date);

    const diff = round1(weightedProgress - elapsedRate);
    const diffStr = diff > 0
      ? `+${diff}% ✅ 順調です！`
      : diff < 0
      ? `${diff}% ⚠️ 遅れています`
      : `±0% ✅ 予定通りです`;

    const statusLabel = semesterValue.status === "active" ? "進行中" : "終了";
    const today = getJstToday().toLocaleDateString("ja-JP");

    const subjectLines = enriched.map((s) => {
      const bar = renderBar(s.progress_pct);
      const pctLabel = s.has_progress ? `${s.progress_pct}%` : "N/A";
      return `  ${s.subject_name} (${s.credits}単位)  ${bar}  ${pctLabel}`;
    }).join("\n");

    const overview_msg =
      `📚 進捗一覧（${today}）\n` +
      `📅 ${semesterValue.year}年 ${semesterValue.season}学期 [${statusLabel}]\n\n` +
      `科目別:\n${subjectLines}\n\n` +
      `全体進捗: ${weightedProgress}% ${renderBar(weightedProgress)}\n` +
      `経過時間: ${elapsedRate}% ${renderBar(elapsedRate)}\n` +
      `差分: ${diffStr}`;

    await client.functions.completeSuccess({
      function_execution_id: body.function_data.execution_id,
      outputs: { overview_msg },
    });

    return { response_action: "clear" as const };
  },
);
