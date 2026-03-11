import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { CreateSemesterFunction } from "../functions/create_semester_function.ts";

const SemesterSetupWorkflow = DefineWorkflow({
  callback_id: "semester_setup_workflow",
  title: "学期を作成する",
  description: "新しい学期を登録するワークフロー",
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

const createStep = SemesterSetupWorkflow.addStep(CreateSemesterFunction, {
  interactivity: SemesterSetupWorkflow.inputs.interactivity,
  user_id: SemesterSetupWorkflow.inputs.user,
  channel: SemesterSetupWorkflow.inputs.channel,
});

SemesterSetupWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: SemesterSetupWorkflow.inputs.channel,
  message: createStep.outputs.confirmation_msg,
});

export default SemesterSetupWorkflow;
