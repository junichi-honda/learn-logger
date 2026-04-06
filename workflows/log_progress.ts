import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as RunLogProgress } from "../functions/run_log_progress.ts";

const LogProgressWorkflow = DefineWorkflow({
  callback_id: "log_progress_workflow",
  title: "Log Progress",
  description: "\u9032\u6357\u3092\u8A18\u9332\u3059\u308B",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel: { type: Schema.slack.types.channel_id },
      user: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "channel", "user"],
  },
});

LogProgressWorkflow.addStep(RunLogProgress, {
  interactivity: LogProgressWorkflow.inputs.interactivity,
  user_id: LogProgressWorkflow.inputs.user,
  channel: LogProgressWorkflow.inputs.channel,
});

export default LogProgressWorkflow;
