import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import type SampleObjectDatastore from "../datastores/sample_datastore.ts";

/**
 * 関数は入力を受け取り、計算を実行し、出力を提供する自動化の再利用可能な
 * ビルディングブロックです。関数は独立して使用することも、
 * ワークフローのステップとして使用することもできます。
 * https://api.slack.com/automation/functions/custom
 */
export const SampleFunctionDefinition = DefineFunction({
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

/**
 * SlackFunctionは2つの引数を取ります：CustomFunctionの定義（上記参照）と、
 * 関数が実行されたときに実行されるハンドラーロジックを含む関数です。
 * https://api.slack.com/automation/functions/custom
 */
export default SlackFunction(
  SampleFunctionDefinition,
  async ({ inputs, client }) => {
    const uuid = crypto.randomUUID();
    // 日本時間（JST）で日付を設定
    const now = new Date();
    // UTC時間から日本時間に調整（UTC+9時間）
    const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒に変換
    const jstDate = new Date(now.getTime() + jstOffset);
    // 時刻部分を00:00:00に固定して日付の境界問題を解消
    const currentDate = new Date(jstDate.getFullYear(), jstDate.getMonth(), jstDate.getDate());
    // 日本時間で開始日と終了日を設定（表示と一致させる）
    const startDate = new Date("2025-09-10T00:00:00+09:00");
    const endDate = new Date("2026-01-20T00:00:00+09:00");
    const timestamp = currentDate.toISOString();
    const date = currentDate.toLocaleDateString("ja-JP");
    const startDateFormatted = startDate.toLocaleDateString("ja-JP");
    const endDateFormatted = endDate.toLocaleDateString("ja-JP");
    
    // 経過日数を計算
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedRate = Math.round((elapsedDays / totalDays) * 100 * 10) / 10; // 小数点第1位まで丸める

    // 進捗と日数の比較メッセージを生成
    let comparisonMessage = "";
    if (inputs.progress > elapsedRate) {
      comparisonMessage = `進捗率は予定より *${Math.round((inputs.progress - elapsedRate) * 10) / 10}%* 進んでいます :rocket:`;
    } else if (inputs.progress < elapsedRate) {
      comparisonMessage = `進捗率は予定より *${Math.round((elapsedRate - inputs.progress) * 10) / 10}%* 遅れています :warning:`;
    } else {
      comparisonMessage = "進捗率は予定通りです :white_check_mark:";
    }

    // 進捗情報を処理
    const updatedMsg = 
      `:chart_with_upwards_trend: <@${inputs.user}>さんの学習進捗記録（${date}）:\n\n` +
      `• 学習の進捗率: *${inputs.progress}%*\n` +
      `• 経過日数率: *${elapsedRate}%* (${elapsedDays}/${totalDays}日)\n` +
      `• 期間: ${startDateFormatted} ～ ${endDateFormatted}\n\n` +
      `${comparisonMessage}`;

    const sampleObject = {
      original_msg: `${inputs.progress}%`,
      updated_msg: updatedMsg,
      object_id: uuid,
      timestamp: timestamp,
    };

    // サンプルオブジェクトをデータストアに保存
    // https://api.slack.com/automation/datastores
    const putResponse = await client.apps.datastore.put({
      datastore: "SampleObjects",
      item: sampleObject,
    });

    if (!putResponse.ok) {
      return {
        error: `データストアへのアイテム保存に失敗しました: ${putResponse.error}`,
      };
    }

    return { outputs: { updatedMsg } };
  },
);