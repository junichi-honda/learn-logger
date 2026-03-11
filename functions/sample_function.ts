import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import LearningLogDatastore from "../datastores/sample_datastore.ts";

// 学習期間の定数
const START_DATE = new Date("2025-09-10T00:00:00+09:00");
const END_DATE = new Date("2026-01-20T00:00:00+09:00");

/**
 * 関数は入力を受け取り、計算を実行し、出力を提供する自動化の再利用可能な
 * ビルディングブロックです。関数は独立して使用することも、
 * ワークフローのステップとして使用することもできます。
 * https://api.slack.com/automation/functions/custom
 */
export const ProcessLearningProgressFunction = DefineFunction({
  callback_id: "sample_function",
  title: "Process Learning Progress",
  description: "Record and process learning progress",
  source_file: "./functions/sample_function.ts",
  input_parameters: {
    properties: {
      progress: {
        type: Schema.types.number,
        description: "学習の進捗率 (%)",
      },
      user: {
        type: Schema.slack.types.user_id,
        description: "ワークフローを実行したユーザー",
      },
    },
    required: ["progress", "user"],
  },
  output_parameters: {
    properties: {
      updatedMsg: {
        type: Schema.types.string,
        description: "更新された進捗メッセージ",
      },
    },
    required: ["updatedMsg"],
  },
});

/** 小数点第1位に丸める */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 日本時間の現在日（時刻なし）を返す */
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

/** ミリ秒差を日数に変換 */
function msToDays(ms: number): number {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * SlackFunctionは2つの引数を取ります：CustomFunctionの定義（上記参照）と、
 * 関数が実行されたときに実行されるハンドラーロジックを含む関数です。
 * https://api.slack.com/automation/functions/custom
 */
export default SlackFunction(
  ProcessLearningProgressFunction,
  async ({ inputs, client }) => {
    const today = getJstToday();
    const totalDays = msToDays(END_DATE.getTime() - START_DATE.getTime());
    const elapsedDays = Math.max(
      0,
      msToDays(today.getTime() - START_DATE.getTime()),
    );
    const elapsedRate = round1((elapsedDays / totalDays) * 100);

    const diff = round1(Math.abs(inputs.progress - elapsedRate));
    let comparisonMessage: string;
    if (inputs.progress > elapsedRate) {
      comparisonMessage = `進捗率は予定より *${diff}%* 進んでいます :rocket:`;
    } else if (inputs.progress < elapsedRate) {
      comparisonMessage = `進捗率は予定より *${diff}%* 遅れています :warning:`;
    } else {
      comparisonMessage = "進捗率は予定通りです :white_check_mark:";
    }

    const dateLabel = today.toLocaleDateString("ja-JP");
    const startLabel = START_DATE.toLocaleDateString("ja-JP");
    const endLabel = END_DATE.toLocaleDateString("ja-JP");

    const updatedMsg =
      `:chart_with_upwards_trend: <@${inputs.user}>さんの学習進捗記録（${dateLabel}）:\n\n` +
      `• 学習の進捗率: *${inputs.progress}%*\n` +
      `• 経過日数率: *${elapsedRate}%* (${elapsedDays}/${totalDays}日)\n` +
      `• 期間: ${startLabel} ～ ${endLabel}\n\n` +
      `${comparisonMessage}`;

    const putResponse = await client.apps.datastore.put<
      typeof LearningLogDatastore.definition
    >({
      datastore: LearningLogDatastore.definition.name,
      item: {
        object_id: crypto.randomUUID(),
        user_id: inputs.user,
        original_msg: `${inputs.progress}%`,
        updated_msg: updatedMsg,
        timestamp: today.toISOString(),
      },
    });

    if (!putResponse.ok) {
      return {
        error: `データストアへのアイテム保存に失敗しました: ${putResponse.error}`,
      };
    }

    return { outputs: { updatedMsg } };
  },
);
