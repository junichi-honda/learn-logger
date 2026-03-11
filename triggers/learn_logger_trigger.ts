import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import LearnLoggerWorkflow from "../workflows/learn_logger.ts";

const learnLoggerTrigger: Trigger<typeof LearnLoggerWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Learn Logger",
  description: "\u5B66\u671F\u30FB\u79D1\u76EE\u306E\u7BA1\u7406\u3068\u5B66\u7FD2\u9032\u6357\u306E\u8A18\u9332\u30FB\u78BA\u8A8D",
  workflow: `#/workflows/${LearnLoggerWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: {
      value: TriggerContextData.Shortcut.interactivity,
    },
    channel: {
      value: TriggerContextData.Shortcut.channel_id,
    },
    user: {
      value: TriggerContextData.Shortcut.user_id,
    },
  },
};

export default learnLoggerTrigger;
