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

const inputForm = SubjectSetupWorkflow.addStep(
  Schema.slack.functions.OpenForm,
  {
    title: "科目を追加する",
    interactivity: SubjectSetupWorkflow.inputs.interactivity,
    submit_label: "追加",
    fields: {
      elements: [
        {
          name: "subject_name",
          title: "科目名",
          type: Schema.types.string,
        },
        {
          name: "credits",
          title: "単位数",
          type: Schema.types.number,
          minimum: 1,
          maximum: 20,
        },
      ],
      required: ["subject_name", "credits"],
    },
  },
);

const addStep = SubjectSetupWorkflow.addStep(AddSubjectFunction, {
  user_id: SubjectSetupWorkflow.inputs.user,
  subject_name: inputForm.outputs.fields.subject_name,
  credits: inputForm.outputs.fields.credits,
});

SubjectSetupWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: SubjectSetupWorkflow.inputs.channel,
  message: addStep.outputs.confirmation_msg,
});

export default SubjectSetupWorkflow;
