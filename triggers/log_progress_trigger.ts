import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import LogProgressWorkflow from "../workflows/log_progress.ts";

const logProgressTrigger: Trigger<typeof LogProgressWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "\u9032\u6357\u3092\u8A18\u9332\u3059\u308B",
  description:
    "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u5B66\u671F\u306E\u9032\u6357\u3092\u76F4\u63A5\u8A18\u9332\u3059\u308B",
  workflow: `#/workflows/${LogProgressWorkflow.definition.callback_id}`,
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

export default logProgressTrigger;
