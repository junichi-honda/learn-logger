import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ManageSubjectFunction } from "../functions/manage_subject_function.ts";

const ManageSubjectWorkflow = DefineWorkflow({
  callback_id: "manage_subject_workflow",
  title: "科目を管理する",
  description: "科目の編集・削除を行うワークフロー",
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

const manageStep = ManageSubjectWorkflow.addStep(ManageSubjectFunction, {
  interactivity: ManageSubjectWorkflow.inputs.interactivity,
  user_id: ManageSubjectWorkflow.inputs.user,
});

ManageSubjectWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: ManageSubjectWorkflow.inputs.channel,
  message: manageStep.outputs.result_msg,
});

export default ManageSubjectWorkflow;
