import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { CloseSemesterFunction } from "../functions/close_semester_function.ts";

const SemesterCloseWorkflow = DefineWorkflow({
  callback_id: "semester_close_workflow",
  title: "学期を終了する",
  description: "アクティブな学期を終了し最終レポートを生成するワークフロー",
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

const closeStep = SemesterCloseWorkflow.addStep(CloseSemesterFunction, {
  interactivity: SemesterCloseWorkflow.inputs.interactivity,
  user_id: SemesterCloseWorkflow.inputs.user,
});

SemesterCloseWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: SemesterCloseWorkflow.inputs.channel,
  message: closeStep.outputs.final_report_msg,
});

export default SemesterCloseWorkflow;
