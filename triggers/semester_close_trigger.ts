import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import SemesterCloseWorkflow from "../workflows/semester_close_workflow.ts";

const semesterCloseTrigger: Trigger<
  typeof SemesterCloseWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "学期を終了する",
  description: "アクティブな学期を終了し最終レポートを生成する",
  workflow: `#/workflows/${SemesterCloseWorkflow.definition.callback_id}`,
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

export default semesterCloseTrigger;
