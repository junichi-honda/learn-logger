import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import SubjectSetupWorkflow from "../workflows/subject_setup_workflow.ts";

const subjectSetupTrigger: Trigger<
  typeof SubjectSetupWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "科目を追加する",
  description: "アクティブな学期に科目と単位数を登録する",
  workflow: `#/workflows/${SubjectSetupWorkflow.definition.callback_id}`,
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

export default subjectSetupTrigger;
