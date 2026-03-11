import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import ManageSubjectWorkflow from "../workflows/manage_subject_workflow.ts";

const manageSubjectTrigger: Trigger<
  typeof ManageSubjectWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "科目を管理する",
  description: "科目の編集・削除を行う",
  workflow: `#/workflows/${ManageSubjectWorkflow.definition.callback_id}`,
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

export default manageSubjectTrigger;
