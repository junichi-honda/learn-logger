import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { LogProgressFunction } from "../functions/log_progress_function.ts";

const LogProgressWorkflow = DefineWorkflow({
  callback_id: "log_progress_workflow",
  title: "進捗を記録する",
  description: "科目の学習進捗を記録するワークフロー",
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

const logStep = LogProgressWorkflow.addStep(LogProgressFunction, {
  interactivity: LogProgressWorkflow.inputs.interactivity,
  user_id: LogProgressWorkflow.inputs.user,
});

LogProgressWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: LogProgressWorkflow.inputs.channel,
  message: logStep.outputs.report_msg,
});

export default LogProgressWorkflow;
