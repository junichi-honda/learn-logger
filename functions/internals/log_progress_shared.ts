import ProgressDatastore from "../../datastores/progress_datastore.ts";
import { CallbackId } from "./constants.ts";
import { calcElapsedRate, getJstToday, renderBar, round1 } from "./datetime.ts";

// ----- Types -----

export interface LogProgressMeta {
  channel: string;
  semester_id: string;
  semester_year: number;
  semester_season: string;
  semester_start: string;
  semester_end: string;
  logged_subjects: Array<{
    subject_id: string;
    subject_name: string;
    credits: number;
    progress_pct: number;
  }>;
  form_seq: number;
  all_subjects: Array<{
    subject_id: string;
    subject_name: string;
    credits: number;
  }>;
}

// ----- View builders -----

function homeButtonBlock() {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        action_id: "back_to_home",
        text: {
          type: "plain_text",
          text: "\u2190 \u30DB\u30FC\u30E0\u306B\u623B\u308B",
        },
      },
    ],
  };
}

export function buildLogProgressView(
  metadata: LogProgressMeta,
  options?: { includeHomeButton?: boolean },
) {
  const includeHome = options?.includeHomeButton ?? true;
  const { logged_subjects, all_subjects, form_seq } = metadata;
  const blocks: Record<string, unknown>[] = [];

  if (includeHome) {
    blocks.push(homeButtonBlock());
  }

  const loggedIds = new Set(logged_subjects.map((s) => s.subject_id));
  const remaining = all_subjects.filter((s) => !loggedIds.has(s.subject_id));

  if (logged_subjects.length > 0) {
    const list = logged_subjects
      .map(
        (s, i) =>
          `${i + 1}. ${s.subject_name}\uFF08${s.credits}\u5358\u4F4D\uFF09 ${
            renderBar(s.progress_pct)
          } ${s.progress_pct}%`,
      )
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${metadata.semester_year}\u5E74 ${metadata.semester_season}\u5B66\u671F*\n\n` +
          `*\u8A18\u9332\u6E08\u307F\uFF08${logged_subjects.length}\u79D1\u76EE\uFF09:*\n${list}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  if (remaining.length === 0) {
    if (logged_subjects.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "\u26A0\uFE0F \u8A18\u9332\u3067\u304D\u308B\u79D1\u76EE\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
        },
      });
    } else {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "\u2705 \u3059\u3079\u3066\u306E\u79D1\u76EE\u306E\u9032\u6357\u3092\u8A18\u9332\u3057\u307E\u3057\u305F\u3002",
        },
      });
    }

    return {
      type: "modal" as const,
      callback_id: CallbackId.LogProgress,
      notify_on_close: true,
      private_metadata: JSON.stringify(metadata),
      title: {
        type: "plain_text" as const,
        text: "\u9032\u6357\u3092\u8A18\u9332\u3059\u308B",
      },
      close: { type: "plain_text" as const, text: "\u5B8C\u4E86" },
      blocks,
    };
  }

  blocks.push({
    type: "input",
    block_id: `subject_block_${form_seq}`,
    label: { type: "plain_text", text: "\u79D1\u76EE" },
    element: {
      type: "static_select",
      action_id: "subject_select",
      placeholder: {
        type: "plain_text",
        text: "\u79D1\u76EE\u3092\u9078\u629E...",
      },
      options: remaining.map((s) => ({
        text: {
          type: "plain_text" as const,
          text: `${s.subject_name} (${s.credits}\u5358\u4F4D)`,
        },
        value: JSON.stringify({
          subject_id: s.subject_id,
          subject_name: s.subject_name,
          credits: s.credits,
        }),
      })),
    },
  });

  blocks.push({
    type: "input",
    block_id: `progress_block_${form_seq}`,
    label: { type: "plain_text", text: "\u9032\u6357\u7387 (%)" },
    element: {
      type: "number_input",
      action_id: "progress_input",
      is_decimal_allowed: false,
      min_value: "0",
      max_value: "100",
      placeholder: { type: "plain_text", text: "0\u301C100" },
    },
  });

  return {
    type: "modal" as const,
    callback_id: CallbackId.LogProgress,
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: {
      type: "plain_text" as const,
      text: "\u9032\u6357\u3092\u8A18\u9332\u3059\u308B",
    },
    submit: { type: "plain_text" as const, text: "\u8A18\u9332" },
    close: { type: "plain_text" as const, text: "\u5B8C\u4E86" },
    blocks,
  };
}

// ----- Submission handler -----

export async function handleLogProgressSubmission(
  // deno-lint-ignore no-explicit-any
  client: any,
  userId: string,
  view: { private_metadata: string; state: Record<string, unknown> },
  viewOptions?: { includeHomeButton?: boolean },
): Promise<
  | { response_action: "update"; view: Record<string, unknown> }
  | { response_action: "errors"; errors: Record<string, string> }
> {
  const metadata: LogProgressMeta = JSON.parse(view.private_metadata);
  const seq = metadata.form_seq;
  // deno-lint-ignore no-explicit-any
  const state = view.state as any;
  const subjectValue = JSON.parse(
    state.values[`subject_block_${seq}`].subject_select.selected_option!.value,
  );
  const progressPct = Number(
    state.values[`progress_block_${seq}`].progress_input.value,
  );

  const putRes = await client.apps.datastore.put({
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
      errors: {
        [`subject_block_${seq}`]:
          `\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${putRes.error}`,
      },
    };
  }

  metadata.logged_subjects.push({
    subject_id: subjectValue.subject_id,
    subject_name: subjectValue.subject_name,
    credits: subjectValue.credits,
    progress_pct: progressPct,
  });
  metadata.form_seq = seq + 1;

  return {
    response_action: "update" as const,
    view: buildLogProgressView(metadata, viewOptions),
  };
}

// ----- Summary message -----

export async function buildLogProgressSummary(
  metadata: LogProgressMeta,
  // deno-lint-ignore no-explicit-any
  client: any,
): Promise<string | null> {
  const { logged_subjects, all_subjects } = metadata;
  if (logged_subjects.length === 0) return null;

  const elapsedRate = calcElapsedRate(
    metadata.semester_start,
    metadata.semester_end,
  );
  const today = getJstToday().toLocaleDateString("ja-JP");

  const subjectLines = logged_subjects
    .map(
      (s) =>
        `  ${s.subject_name} (${s.credits}\u5358\u4F4D)  ${
          renderBar(s.progress_pct)
        }  ${s.progress_pct}%`,
    )
    .join("\n");

  // 全科目の進捗を DB から取得して全体の加重平均を計算
  const subjectIds = new Set(all_subjects.map((s) => s.subject_id));
  const progressRes = await client.apps.datastore.query({
    datastore: ProgressDatastore.definition.name,
  });
  const progressMap = new Map<string, number>();
  for (const p of progressRes.items ?? []) {
    if (subjectIds.has(p.subject_id as string)) {
      progressMap.set(p.subject_id as string, p.progress_pct as number);
    }
  }
  // 今回記録した分を上書き（DB 書き込み済みだが念のため）
  for (const s of logged_subjects) {
    progressMap.set(s.subject_id, s.progress_pct);
  }

  const totalCredits = all_subjects.reduce((sum, s) => sum + s.credits, 0);
  const weightedProgress = totalCredits > 0
    ? round1(
      all_subjects.reduce(
        (sum, s) => sum + s.credits * (progressMap.get(s.subject_id) ?? 0),
        0,
      ) / totalCredits,
    )
    : 0;

  const diff = round1(weightedProgress - elapsedRate);
  const diffStr = diff > 0
    ? `+${diff}% \u2705 \u9806\u8ABF\u3067\u3059\uFF01`
    : diff < 0
    ? `${diff}% \u26A0\uFE0F \u9045\u308C\u3066\u3044\u307E\u3059`
    : `\u00B10% \u2705 \u4E88\u5B9A\u901A\u308A\u3067\u3059`;

  return (
    `\u2705 ${logged_subjects.length}\u79D1\u76EE\u306E\u9032\u6357\u3092\u8A18\u9332\u3057\u307E\u3057\u305F\uFF08${today}\uFF09\n` +
    `\uD83D\uDCC5 ${metadata.semester_year}\u5E74 ${metadata.semester_season}\u5B66\u671F\n\n` +
    `${subjectLines}\n\n` +
    `\u5168\u4F53\u9032\u6357: ${weightedProgress}% ${
      renderBar(weightedProgress)
    }\n` +
    `\u7D4C\u904E\u6642\u9593: ${elapsedRate}% ${renderBar(elapsedRate)}\n` +
    `\u5DEE\u5206: ${diffStr}`
  );
}
