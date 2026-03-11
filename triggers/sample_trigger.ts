import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import LearnLogWorkflow from "../workflows/sample_workflow.ts";
/**
 * トリガーはワークフローが実行されるタイミングを決定します。
 * トリガーファイルは、ユーザーがボタンを押したときや特定のイベントが
 * 発生したときなど、ワークフローが実行されるべきシナリオを記述します。
 * https://api.slack.com/automation/triggers
 */
const sampleTrigger: Trigger<typeof LearnLogWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Record Learning Progress",
  description: "Record learning progress and compare with elapsed days",
  workflow: `#/workflows/${LearnLogWorkflow.definition.callback_id}`,
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

export default sampleTrigger;
