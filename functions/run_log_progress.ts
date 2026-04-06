import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SubjectsDatastore from "../datastores/subjects_datastore.ts";
import { CallbackId } from "./internals/constants.ts";
import { completeQuietly, fetchActiveSemester } from "./internals/helpers.ts";
import {
  buildLogProgressSummary,
  buildLogProgressView,
  handleLogProgressSubmission,
  type LogProgressMeta,
} from "./internals/log_progress_shared.ts";

export const def = DefineFunction({
  callback_id: "run_log_progress",
  title: "Log Progress",
  source_file: "./functions/run_log_progress.ts",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      user_id: { type: Schema.slack.types.user_id },
      channel: { type: Schema.slack.types.channel_id },
    },
    required: ["interactivity", "user_id", "channel"],
  },
  output_parameters: { properties: {}, required: [] },
});

function buildErrorView(channel: string, message: string) {
  return {
    type: "modal" as const,
    callback_id: CallbackId.LogProgressStandalone,
    notify_on_close: true,
    private_metadata: JSON.stringify({ channel }),
    title: {
      type: "plain_text" as const,
      text: "\u9032\u6357\u3092\u8A18\u9332\u3059\u308B",
    },
    close: { type: "plain_text" as const, text: "\u9589\u3058\u308B" },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: message },
      },
    ],
  };
}

export default SlackFunction(def, async ({ inputs, client }) => {
  const semester = await fetchActiveSemester(client, inputs.user_id);
  if (!semester) {
    await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: buildErrorView(
        inputs.channel,
        "\u26A0\uFE0F \u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u5B66\u671F\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u5148\u306B\u300C\u5B66\u671F\u3092\u4F5C\u6210\u3059\u308B\u300D\u3067\u5B66\u671F\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      ),
    });
    return { completed: false };
  }

  const subjectsRes = await client.apps.datastore.query<
    typeof SubjectsDatastore.definition
  >({
    datastore: SubjectsDatastore.definition.name,
    expression: "semester_id = :sid",
    expression_values: { ":sid": semester.semester_id },
  });

  if (!subjectsRes.ok || subjectsRes.items.length === 0) {
    await client.views.open({
      trigger_id: inputs.interactivity.interactivity_pointer,
      view: buildErrorView(
        inputs.channel,
        "\u26A0\uFE0F \u767B\u9332\u3055\u308C\u3066\u3044\u308B\u79D1\u76EE\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u5148\u306B\u300C\u79D1\u76EE\u3092\u8FFD\u52A0\u3059\u308B\u300D\u3067\u79D1\u76EE\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      ),
    });
    return { completed: false };
  }

  const logMeta: LogProgressMeta = {
    channel: inputs.channel,
    semester_id: semester.semester_id,
    semester_year: semester.year,
    semester_season: semester.season,
    semester_start: semester.start_date,
    semester_end: semester.end_date,
    logged_subjects: [],
    form_seq: 0,
    all_subjects: subjectsRes.items.map((s: Record<string, unknown>) => ({
      subject_id: s.subject_id as string,
      subject_name: s.subject_name as string,
      credits: s.credits as number,
    })),
  };

  const openRes = await client.views.open({
    trigger_id: inputs.interactivity.interactivity_pointer,
    view: buildLogProgressView(logMeta, { includeHomeButton: false }),
  });
  if (!openRes.ok) {
    return {
      error:
        `\u30E2\u30FC\u30C0\u30EB\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F: ${openRes.error}`,
    };
  }
  return { completed: false };
})
  .addViewSubmissionHandler(
    CallbackId.LogProgress,
    async ({ view, client, body }) => {
      return await handleLogProgressSubmission(client, body.user.id, view, {
        includeHomeButton: false,
      });
    },
  )
  .addViewClosedHandler(
    [CallbackId.LogProgress, CallbackId.LogProgressStandalone],
    async ({ view, body, client }) => {
      const meta = JSON.parse(view.private_metadata!);
      if (meta.logged_subjects) {
        const msg = buildLogProgressSummary(meta as LogProgressMeta);
        if (msg) {
          await client.chat.postMessage({ channel: meta.channel, text: msg });
        }
      }
      await completeQuietly(client, body.function_data.execution_id);
    },
  );
