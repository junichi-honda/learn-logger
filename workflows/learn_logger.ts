import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as RunLearnLogger } from "../functions/run_learn_logger.ts";

const LearnLoggerWorkflow = DefineWorkflow({
  callback_id: "learn_logger_workflow",
  title: "Learn Logger",
  description:
    "\u5B66\u671F\u30FB\u79D1\u76EE\u306E\u7BA1\u7406\u3068\u5B66\u7FD2\u9032\u6357\u306E\u8A18\u9332\u30FB\u78BA\u8A8D\u3092\u884C\u3046\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel: { type: Schema.slack.types.channel_id },
      user: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "channel", "user"],
  },
});

LearnLoggerWorkflow.addStep(RunLearnLogger, {
  interactivity: LearnLoggerWorkflow.inputs.interactivity,
  user_id: LearnLoggerWorkflow.inputs.user,
  channel: LearnLoggerWorkflow.inputs.channel,
});

export default LearnLoggerWorkflow;
