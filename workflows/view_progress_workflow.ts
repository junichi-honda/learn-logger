import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ViewProgressFunction } from "../functions/view_progress_function.ts";

const ViewProgressWorkflow = DefineWorkflow({
  callback_id: "view_progress_workflow",
  title: "進捗を確認する",
  description: "学期の全科目進捗を一覧表示するワークフロー",
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

const viewStep = ViewProgressWorkflow.addStep(ViewProgressFunction, {
  interactivity: ViewProgressWorkflow.inputs.interactivity,
  user_id: ViewProgressWorkflow.inputs.user,
});

ViewProgressWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: ViewProgressWorkflow.inputs.channel,
  message: viewStep.outputs.overview_msg,
});

export default ViewProgressWorkflow;
