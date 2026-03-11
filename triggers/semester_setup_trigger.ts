import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import SemesterSetupWorkflow from "../workflows/semester_setup_workflow.ts";

const semesterSetupTrigger: Trigger<
  typeof SemesterSetupWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "学期を作成する",
  description: "新しい学期（年度・学期・期間）を登録する",
  workflow: `#/workflows/${SemesterSetupWorkflow.definition.callback_id}`,
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

export default semesterSetupTrigger;
