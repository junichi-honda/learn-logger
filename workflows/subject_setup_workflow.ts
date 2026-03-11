import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { AddSubjectFunction } from "../functions/add_subject_function.ts";

const SubjectSetupWorkflow = DefineWorkflow({
  callback_id: "subject_setup_workflow",
  title: "科目を追加する",
  description: "アクティブな学期に科目を追加するワークフロー",
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

const addStep = SubjectSetupWorkflow.addStep(AddSubjectFunction, {
  interactivity: SubjectSetupWorkflow.inputs.interactivity,
  user_id: SubjectSetupWorkflow.inputs.user,
});

SubjectSetupWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: SubjectSetupWorkflow.inputs.channel,
  message: addStep.outputs.confirmation_msg,
});

export default SubjectSetupWorkflow;
