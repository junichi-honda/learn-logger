import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import ViewProgressWorkflow from "../workflows/view_progress_workflow.ts";

const viewProgressTrigger: Trigger<
  typeof ViewProgressWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "進捗を確認する",
  description: "学期を選択して全科目の進捗を一覧表示する",
  workflow: `#/workflows/${ViewProgressWorkflow.definition.callback_id}`,
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

export default viewProgressTrigger;
