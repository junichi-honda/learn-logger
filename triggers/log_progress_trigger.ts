import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import LogProgressWorkflow from "../workflows/log_progress_workflow.ts";

const logProgressTrigger: Trigger<typeof LogProgressWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "進捗を記録する",
  description: "科目を選択して学習進捗（%）を記録する",
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
