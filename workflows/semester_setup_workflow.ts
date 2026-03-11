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

const inputForm = SemesterSetupWorkflow.addStep(
  Schema.slack.functions.OpenForm,
  {
    title: "学期を登録する",
    interactivity: SemesterSetupWorkflow.inputs.interactivity,
    submit_label: "登録",
    fields: {
      elements: [
        {
          name: "year",
          title: "年度 (例: 2025)",
          type: Schema.types.number,
        },
        {
          name: "season",
          title: "学期",
          type: Schema.types.string,
          enum: ["春", "秋"],
          choices: [
            { value: "春", title: "春学期" },
            { value: "秋", title: "秋学期" },
          ],
        },
        {
          name: "start_date",
          title: "開始日 (YYYY-MM-DD)",
          type: Schema.types.string,
        },
        {
          name: "end_date",
          title: "終了日 (YYYY-MM-DD)",
          type: Schema.types.string,
        },
      ],
      required: ["year", "season", "start_date", "end_date"],
    },
  },
);

const createStep = SemesterSetupWorkflow.addStep(CreateSemesterFunction, {
  user_id: SemesterSetupWorkflow.inputs.user,
  year: inputForm.outputs.fields.year,
  season: inputForm.outputs.fields.season,
  start_date: inputForm.outputs.fields.start_date,
  end_date: inputForm.outputs.fields.end_date,
});

SemesterSetupWorkflow.addStep(Schema.slack.functions.SendMessage, {
  channel_id: SemesterSetupWorkflow.inputs.channel,
  message: createStep.outputs.confirmation_msg,
});

export default SemesterSetupWorkflow;
