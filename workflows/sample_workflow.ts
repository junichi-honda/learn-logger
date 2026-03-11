import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ProcessLearningProgressFunction } from "../functions/sample_function.ts";

/**
 * ワークフローは順番に実行される一連のステップです。
 * ワークフロー内の各ステップは関数です。
 * https://api.slack.com/automation/workflows
 *
 * このワークフローはインタラクティブ機能を使用しています。詳細はこちら：
 * https://api.slack.com/automation/forms#add-interactivity
 */
const LearnLogWorkflow = DefineWorkflow({
  callback_id: "sample_workflow",
  title: "Learning Progress Logger",
  description: "Record learning progress workflow",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      channel: {
        type: Schema.slack.types.channel_id,
      },
      user: {
        type: Schema.slack.types.user_id,
      },
    },
    required: ["interactivity", "channel", "user"],
  },
});

/**
 * ユーザーからの入力を収集するために、最初のステップとして
 * OpenForm Slack関数を使用することをお勧めします。
 * https://api.slack.com/automation/functions#open-a-form
 */
const inputForm = LearnLogWorkflow.addStep(
  Schema.slack.functions.OpenForm,
  {
    title: "Record Learning Progress",
    interactivity: LearnLogWorkflow.inputs.interactivity,
    submit_label: "Record",
    fields: {
      elements: [{
        name: "channel",
        title: "Channel to record progress",
        type: Schema.slack.types.channel_id,
        default: LearnLogWorkflow.inputs.channel,
      }, {
        name: "progress",
        title: "Learning progress (%)",
        type: Schema.types.number,
        minimum: 0,
        maximum: 100,
      }],
      required: ["channel", "progress"],
    },
  },
);

/**
 * カスタム関数は、Slackインフラストラクチャにデプロイされる
 * 再利用可能な自動化のビルディングブロックです。
 * 一般的なプログラム関数と同様に、入力を受け取り、計算を実行し、
 * 出力を提供します。
 * https://api.slack.com/automation/functions/custom
 */
const progressStep = LearnLogWorkflow.addStep(ProcessLearningProgressFunction, {
  progress: inputForm.outputs.fields.progress,
  user: LearnLogWorkflow.inputs.user,
});

/**
 * SendMessageはSlack関数です。これらは
 * チャンネルの作成やメッセージの送信などのSlackネイティブなアクションであり、
 * ワークフロー内でカスタム関数と一緒に使用できます。
 * https://api.slack.com/automation/functions
 */
LearnLogWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: inputForm.outputs.fields.channel,
  message: progressStep.outputs.updatedMsg,
});

export default LearnLogWorkflow;
