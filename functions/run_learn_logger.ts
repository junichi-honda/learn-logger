import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import SemestersDatastore from "../datastores/semesters_datastore.ts";
import SubjectsDatastore from "../datastores/subjects_datastore.ts";
import ProgressDatastore from "../datastores/progress_datastore.ts";
import { ActionId, CallbackId, MenuAction } from "./internals/constants.ts";
import {
  calcElapsedRate,
  getJstToday,
  renderBar,
  round1,
} from "./internals/datetime.ts";
import { completeQuietly, fetchActiveSemester } from "./internals/helpers.ts";
import {
  buildLogProgressSummary,
  buildLogProgressView,
  handleLogProgressAndFinish,
  handleLogProgressSubmission,
  type LogProgressMeta,
} from "./internals/log_progress_shared.ts";

// ----- Types -----

interface SubjectItem {
  subject_id: string;
  subject_name: string;
  credits: number;
}

interface AddSubjectMeta {
  channel: string;
  semester_id: string;
  semester_year: number;
  semester_season: string;
  added_subjects: Array<{ name: string; credits: number }>;
  form_seq: number;
}

interface ManageSubjectMeta {
  channel: string;
  semester_id: string;
  semester_year: number;
  semester_season: string;
  mode: "list" | "edit" | "confirm_delete";
  editing_subject?: SubjectItem;
  deleting_subject?: SubjectItem;
  form_seq: number;
}

// ----- Function definition -----

export const def = DefineFunction({
  callback_id: "run_learn_logger",
  title: "Learn Logger",
  source_file: "./functions/run_learn_logger.ts",
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

// ----- View builders -----

function homeButtonBlock() {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        action_id: ActionId.BackToHome,
        text: {
          type: "plain_text",
          text: "\u2190 \u30DB\u30FC\u30E0\u306B\u623B\u308B",
        },
      },
    ],
  };
}

function buildMainMenuView(channel: string) {
  return {
    type: "modal" as const,
    callback_id: CallbackId.MainMenu,
    notify_on_close: true,
    private_metadata: JSON.stringify({ channel }),
    title: { type: "plain_text" as const, text: "Learn Logger" },
    submit: { type: "plain_text" as const, text: "\u9078\u629E" },
    close: { type: "plain_text" as const, text: "\u9589\u3058\u308B" },
    blocks: [
      {
        type: "input",
        block_id: "menu_block",
        label: { type: "plain_text", text: "\u30E1\u30CB\u30E5\u30FC" },
        element: {
          type: "radio_buttons",
          action_id: "menu_select",
          options: [
            {
              text: {
                type: "plain_text",
                text: "\uD83D\uDCC5 \u5B66\u671F\u3092\u4F5C\u6210\u3059\u308B",
              },
              value: MenuAction.CreateSemester,
            },
            {
              text: {
                type: "plain_text",
                text: "\uD83D\uDCDA \u79D1\u76EE\u3092\u8FFD\u52A0\u3059\u308B",
              },
              value: MenuAction.AddSubject,
            },
            {
              text: {
                type: "plain_text",
                text: "\uD83D\uDCCB \u79D1\u76EE\u3092\u7BA1\u7406\u3059\u308B",
              },
              value: MenuAction.ManageSubject,
            },
            {
              text: {
                type: "plain_text",
                text: "\u270F\uFE0F \u9032\u6357\u3092\u8A18\u9332\u3059\u308B",
              },
              value: MenuAction.LogProgress,
            },
            {
              text: {
                type: "plain_text",
                text: "\uD83D\uDCCA \u9032\u6357\u3092\u78BA\u8A8D\u3059\u308B",
              },
              value: MenuAction.ViewProgress,
            },
            {
              text: {
                type: "plain_text",
                text: "\uD83C\uDF93 \u5B66\u671F\u3092\u7D42\u4E86\u3059\u308B",
              },
              value: MenuAction.CloseSemester,
            },
          ],
        },
      },
    ],
  };
}

function buildInfoView(channel: string, message: string) {
  return {
    type: "modal" as const,
    callback_id: CallbackId.InfoView,
    notify_on_close: true,
    private_metadata: JSON.stringify({ channel }),
    title: { type: "plain_text" as const, text: "Learn Logger" },
    close: { type: "plain_text" as const, text: "\u9589\u3058\u308B" },
    blocks: [
      homeButtonBlock(),
      {
        type: "section",
        text: { type: "mrkdwn", text: message },
      },
    ],
  };
}

function buildCreateSemesterView(channel: string) {
  return {
    type: "modal" as const,
    callback_id: CallbackId.CreateSemester,
    notify_on_close: true,
    private_metadata: JSON.stringify({ channel }),
    title: {
      type: "plain_text" as const,
      text: "\u5B66\u671F\u3092\u767B\u9332\u3059\u308B",
    },
    submit: { type: "plain_text" as const, text: "\u767B\u9332" },
    close: {
      type: "plain_text" as const,
      text: "\u30AD\u30E3\u30F3\u30BB\u30EB",
    },
    blocks: [
      homeButtonBlock(),
      {
        type: "input",
        block_id: "year_block",
        label: { type: "plain_text", text: "\u5E74\u5EA6 (\u4F8B: 2025)" },
        element: {
          type: "number_input",
          action_id: "year_input",
          is_decimal_allowed: false,
          placeholder: { type: "plain_text", text: "2025" },
        },
      },
      {
        type: "input",
        block_id: "season_block",
        label: { type: "plain_text", text: "\u5B66\u671F" },
        element: {
          type: "static_select",
          action_id: "season_select",
          options: [
            {
              text: { type: "plain_text", text: "\u6625\u5B66\u671F" },
              value: "\u6625",
            },
            {
              text: { type: "plain_text", text: "\u79CB\u5B66\u671F" },
              value: "\u79CB",
            },
          ],
        },
      },
      {
        type: "input",
        block_id: "start_date_block",
        label: { type: "plain_text", text: "\u958B\u59CB\u65E5" },
        element: { type: "datepicker", action_id: "start_date_picker" },
      },
      {
        type: "input",
        block_id: "end_date_block",
        label: { type: "plain_text", text: "\u7D42\u4E86\u65E5" },
        element: { type: "datepicker", action_id: "end_date_picker" },
      },
    ],
  };
}

function buildAddSubjectView(metadata: AddSubjectMeta) {
  const { semester_year, semester_season, added_subjects, form_seq } = metadata;
  const blocks: Record<string, unknown>[] = [homeButtonBlock()];

  if (added_subjects.length > 0) {
    const list = added_subjects
      .map((s, i) => `${i + 1}. ${s.name}\uFF08${s.credits}\u5358\u4F4D\uFF09`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${semester_year}\u5E74 ${semester_season}\u5B66\u671F*\n\n` +
          `*\u767B\u9332\u6E08\u307F\uFF08${added_subjects.length}\u79D1\u76EE\uFF09:*\n${list}`,
      },
    });
    blocks.push({ type: "divider" });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${semester_year}\u5E74 ${semester_season}\u5B66\u671F* \u306B\u79D1\u76EE\u3092\u8FFD\u52A0\u3057\u307E\u3059`,
      },
    });
  }

  blocks.push({
    type: "input",
    block_id: `subject_name_block_${form_seq}`,
    label: { type: "plain_text", text: "\u79D1\u76EE\u540D" },
    element: {
      type: "plain_text_input",
      action_id: "subject_name_input",
      placeholder: {
        type: "plain_text",
        text: "\u79D1\u76EE\u540D\u3092\u5165\u529B...",
      },
    },
  });
  blocks.push({
    type: "input",
    block_id: `credits_block_${form_seq}`,
    label: { type: "plain_text", text: "\u5358\u4F4D\u6570" },
    element: {
      type: "static_select",
      action_id: "credits_select",
      options: [
        { text: { type: "plain_text", text: "1\u5358\u4F4D" }, value: "1" },
        { text: { type: "plain_text", text: "2\u5358\u4F4D" }, value: "2" },
      ],
    },
  });

  return {
    type: "modal" as const,
    callback_id: CallbackId.AddSubject,
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: {
      type: "plain_text" as const,
      text: "\u79D1\u76EE\u3092\u8FFD\u52A0\u3059\u308B",
    },
    submit: { type: "plain_text" as const, text: "\u8FFD\u52A0" },
    close: { type: "plain_text" as const, text: "\u5B8C\u4E86" },
    blocks,
  };
}

function buildManageListView(
  metadata: ManageSubjectMeta,
  subjects: SubjectItem[],
) {
  const { semester_year, semester_season, form_seq } = metadata;
  const blocks: Record<string, unknown>[] = [homeButtonBlock()];

  if (subjects.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${semester_year}\u5E74 ${semester_season}\u5B66\u671F*\n\n\u767B\u9332\u3055\u308C\u3066\u3044\u308B\u79D1\u76EE\u304C\u3042\u308A\u307E\u305B\u3093\u3002`,
      },
    });
    return {
      type: "modal" as const,
      callback_id: CallbackId.ManageSubject,
      notify_on_close: true,
      private_metadata: JSON.stringify(metadata),
      title: {
        type: "plain_text" as const,
        text: "\u79D1\u76EE\u3092\u7BA1\u7406\u3059\u308B",
      },
      close: { type: "plain_text" as const, text: "\u9589\u3058\u308B" },
      blocks,
    };
  }

  const list = subjects
    .map((s) => `\u2022 ${s.subject_name}\uFF08${s.credits}\u5358\u4F4D\uFF09`)
    .join("\n");
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${semester_year}\u5E74 ${semester_season}\u5B66\u671F*\n\n` +
        `*\u767B\u9332\u6E08\u307F\uFF08${subjects.length}\u79D1\u76EE\uFF09:*\n${list}`,
    },
  });
  blocks.push({ type: "divider" });
  blocks.push({
    type: "input",
    block_id: `subject_select_block_${form_seq}`,
    label: { type: "plain_text", text: "\u79D1\u76EE\u3092\u9078\u629E" },
    element: {
      type: "static_select",
      action_id: "subject_select",
      placeholder: {
        type: "plain_text",
        text: "\u79D1\u76EE\u3092\u9078\u629E...",
      },
      options: subjects.map((s) => ({
        text: {
          type: "plain_text" as const,
          text: `${s.subject_name}\uFF08${s.credits}\u5358\u4F4D\uFF09`,
        },
        value: JSON.stringify(s),
      })),
    },
  });
  blocks.push({
    type: "input",
    block_id: `action_block_${form_seq}`,
    label: { type: "plain_text", text: "\u64CD\u4F5C" },
    element: {
      type: "radio_buttons",
      action_id: "action_select",
      options: [
        { text: { type: "plain_text", text: "\u7DE8\u96C6" }, value: "edit" },
        { text: { type: "plain_text", text: "\u524A\u9664" }, value: "delete" },
      ],
    },
  });

  return {
    type: "modal" as const,
    callback_id: CallbackId.ManageSubject,
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: {
      type: "plain_text" as const,
      text: "\u79D1\u76EE\u3092\u7BA1\u7406\u3059\u308B",
    },
    submit: { type: "plain_text" as const, text: "\u5B9F\u884C" },
    close: { type: "plain_text" as const, text: "\u9589\u3058\u308B" },
    blocks,
  };
}

function buildManageEditView(metadata: ManageSubjectMeta) {
  const { editing_subject, form_seq } = metadata;
  if (!editing_subject) throw new Error("No subject to edit");

  return {
    type: "modal" as const,
    callback_id: CallbackId.ManageSubject,
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: {
      type: "plain_text" as const,
      text: "\u79D1\u76EE\u3092\u7DE8\u96C6\u3059\u308B",
    },
    submit: { type: "plain_text" as const, text: "\u4FDD\u5B58" },
    close: { type: "plain_text" as const, text: "\u623B\u308B" },
    blocks: [
      homeButtonBlock(),
      {
        type: "input",
        block_id: `edit_name_block_${form_seq}`,
        label: { type: "plain_text", text: "\u79D1\u76EE\u540D" },
        element: {
          type: "plain_text_input",
          action_id: "edit_name_input",
          initial_value: editing_subject.subject_name,
        },
      },
      {
        type: "input",
        block_id: `edit_credits_block_${form_seq}`,
        label: { type: "plain_text", text: "\u5358\u4F4D\u6570" },
        element: {
          type: "static_select",
          action_id: "edit_credits_select",
          initial_option: {
            text: {
              type: "plain_text",
              text: `${editing_subject.credits}\u5358\u4F4D`,
            },
            value: String(editing_subject.credits),
          },
          options: [
            { text: { type: "plain_text", text: "1\u5358\u4F4D" }, value: "1" },
            { text: { type: "plain_text", text: "2\u5358\u4F4D" }, value: "2" },
          ],
        },
      },
    ],
  };
}

function buildConfirmDeleteView(metadata: ManageSubjectMeta) {
  const { deleting_subject } = metadata;
  if (!deleting_subject) throw new Error("No subject to delete");

  return {
    type: "modal" as const,
    callback_id: CallbackId.ManageSubject,
    notify_on_close: true,
    private_metadata: JSON.stringify(metadata),
    title: {
      type: "plain_text" as const,
      text: "\u524A\u9664\u306E\u78BA\u8A8D",
    },
    submit: { type: "plain_text" as const, text: "\u524A\u9664\u3059\u308B" },
    close: {
      type: "plain_text" as const,
      text: "\u30AD\u30E3\u30F3\u30BB\u30EB",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `\u26A0\uFE0F \u79D1\u76EE\u300C*${deleting_subject.subject_name}*\u300D\uFF08${deleting_subject.credits}\u5358\u4F4D\uFF09\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F\n\n\u8A18\u9332\u6E08\u307F\u306E\u9032\u6357\u30C7\u30FC\u30BF\u3082\u4E00\u7DD2\u306B\u524A\u9664\u3055\u308C\u307E\u3059\u3002\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002`,
        },
      },
    ],
  };
}

function buildViewProgressView(
  channel: string,
  semesters: Array<Record<string, unknown>>,
  activeSemesterId?: string,
) {
  const options = semesters.map((s) => {
    const statusLabel = s.status === "active"
      ? "\u9032\u884C\u4E2D"
      : "\u7D42\u4E86";
    return {
      text: {
        type: "plain_text" as const,
        text: `${s.year}\u5E74 ${s.season}\u5B66\u671F [${statusLabel}]`,
      },
      value: JSON.stringify({
        semester_id: s.semester_id,
        year: s.year,
        season: s.season,
        start_date: s.start_date,
        end_date: s.end_date,
        status: s.status,
      }),
    };
  });
  const initialOption = activeSemesterId
    ? options.find((o) => {
      const parsed = JSON.parse(o.value);
      return parsed.semester_id === activeSemesterId;
    })
    : undefined;
  return {
    type: "modal" as const,
    callback_id: CallbackId.ViewProgress,
    notify_on_close: true,
    private_metadata: JSON.stringify({ channel }),
    title: {
      type: "plain_text" as const,
      text: "\u9032\u6357\u3092\u78BA\u8A8D\u3059\u308B",
    },
    submit: { type: "plain_text" as const, text: "\u8868\u793A" },
    close: {
      type: "plain_text" as const,
      text: "\u30AD\u30E3\u30F3\u30BB\u30EB",
    },
    blocks: [
      homeButtonBlock(),
      {
        type: "input",
        block_id: "semester_block",
        label: { type: "plain_text", text: "\u5B66\u671F\u3092\u9078\u629E" },
        element: {
          type: "static_select",
          action_id: "semester_select",
          placeholder: {
            type: "plain_text",
            text: "\u5B66\u671F\u3092\u9078\u629E...",
          },
          options,
          ...(initialOption ? { initial_option: initialOption } : {}),
        },
      },
    ],
  };
}

function buildCloseSemesterView(
  channel: string,
  semester: Record<string, unknown>,
) {
  return {
    type: "modal" as const,
    callback_id: CallbackId.CloseSemester,
    notify_on_close: true,
    private_metadata: JSON.stringify({
      channel,
      semester_id: semester.semester_id,
      year: semester.year,
      season: semester.season,
      end_date: semester.end_date,
    }),
    title: {
      type: "plain_text" as const,
      text: "\u5B66\u671F\u3092\u7D42\u4E86\u3059\u308B",
    },
    submit: { type: "plain_text" as const, text: "\u7D42\u4E86\u3059\u308B" },
    close: {
      type: "plain_text" as const,
      text: "\u30AD\u30E3\u30F3\u30BB\u30EB",
    },
    blocks: [
      homeButtonBlock(),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${semester.year}\u5E74 ${semester.season}\u5B66\u671F* \u3092\u7D42\u4E86\u3057\u307E\u3059\u304B\uFF1F\n\n\u26A0\uFE0F \u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002`,
        },
      },
    ],
  };
}

// ----- Helpers -----

async function querySubjects(
  // deno-lint-ignore no-explicit-any
  client: any,
  semesterId: string,
): Promise<SubjectItem[]> {
  const res = await client.apps.datastore.query({
    datastore: SubjectsDatastore.definition.name,
    expression: "semester_id = :sid",
    expression_values: { ":sid": semesterId },
  });
  return (res.items ?? []).map((s: Record<string, unknown>) => ({
    subject_id: s.subject_id as string,
    subject_name: s.subject_name as string,
    credits: s.credits as number,
  }));
}

// ----- Main handler -----

export default SlackFunction(def, async ({ inputs, client }) => {
  const openRes = await client.views.open({
    trigger_id: inputs.interactivity.interactivity_pointer,
    view: buildMainMenuView(inputs.channel),
  });
  if (!openRes.ok) {
    return {
      error:
        `\u30E2\u30FC\u30C0\u30EB\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F: ${openRes.error}`,
    };
  }
  return { completed: false };
})
  // ----- Main menu submission -----

  .addViewSubmissionHandler(
    CallbackId.MainMenu,
    async ({ view, client, body }) => {
      const { channel } = JSON.parse(view.private_metadata!);
      const selected =
        view.state.values.menu_block.menu_select.selected_option!.value;
      const userId = body.user.id;

      const noActiveSemesterMsg =
        "\u26A0\uFE0F \u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u5B66\u671F\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u5148\u306B\u300C\u5B66\u671F\u3092\u4F5C\u6210\u3059\u308B\u300D\u3067\u5B66\u671F\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002";

      switch (selected) {
        case MenuAction.CreateSemester: {
          return {
            response_action: "update" as const,
            view: buildCreateSemesterView(channel),
          };
        }

        case MenuAction.AddSubject: {
          const semester = await fetchActiveSemester(client, userId);
          if (!semester) {
            return {
              response_action: "update" as const,
              view: buildInfoView(channel, noActiveSemesterMsg),
            };
          }
          return {
            response_action: "update" as const,
            view: buildAddSubjectView({
              channel,
              semester_id: semester.semester_id,
              semester_year: semester.year,
              semester_season: semester.season,
              added_subjects: [],
              form_seq: 0,
            }),
          };
        }

        case MenuAction.ManageSubject: {
          const semester = await fetchActiveSemester(client, userId);
          if (!semester) {
            return {
              response_action: "update" as const,
              view: buildInfoView(channel, noActiveSemesterMsg),
            };
          }
          const subjects = await querySubjects(client, semester.semester_id);
          const meta: ManageSubjectMeta = {
            channel,
            semester_id: semester.semester_id,
            semester_year: semester.year,
            semester_season: semester.season,
            mode: "list",
            form_seq: 0,
          };
          return {
            response_action: "update" as const,
            view: buildManageListView(meta, subjects),
          };
        }

        case MenuAction.LogProgress: {
          const semester = await fetchActiveSemester(client, userId);
          if (!semester) {
            return {
              response_action: "update" as const,
              view: buildInfoView(channel, noActiveSemesterMsg),
            };
          }
          const subjectsRes = await client.apps.datastore.query<
            typeof SubjectsDatastore.definition
          >({
            datastore: SubjectsDatastore.definition.name,
            expression: "semester_id = :sid",
            expression_values: { ":sid": semester.semester_id },
          });
          if (!subjectsRes.ok || subjectsRes.items.length === 0) {
            return {
              response_action: "update" as const,
              view: buildInfoView(
                channel,
                "\u26A0\uFE0F \u767B\u9332\u3055\u308C\u3066\u3044\u308B\u79D1\u76EE\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u5148\u306B\u300C\u79D1\u76EE\u3092\u8FFD\u52A0\u3059\u308B\u300D\u3067\u79D1\u76EE\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
              ),
            };
          }
          const logMeta: LogProgressMeta = {
            channel,
            semester_id: semester.semester_id,
            semester_year: semester.year,
            semester_season: semester.season,
            semester_start: semester.start_date,
            semester_end: semester.end_date,
            logged_subjects: [],
            form_seq: 0,
            all_subjects: subjectsRes.items.map(
              (s: Record<string, unknown>) => ({
                subject_id: s.subject_id as string,
                subject_name: s.subject_name as string,
                credits: s.credits as number,
              }),
            ),
          };
          return {
            response_action: "update" as const,
            view: buildLogProgressView(logMeta),
          };
        }

        case MenuAction.ViewProgress: {
          const semestersRes = await client.apps.datastore.query<
            typeof SemestersDatastore.definition
          >({
            datastore: SemestersDatastore.definition.name,
            expression: "user_id = :uid",
            expression_values: { ":uid": userId },
          });
          if (!semestersRes.ok || semestersRes.items.length === 0) {
            return {
              response_action: "update" as const,
              view: buildInfoView(
                channel,
                "\u26A0\uFE0F \u5B66\u671F\u304C\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u5148\u306B\u300C\u5B66\u671F\u3092\u4F5C\u6210\u3059\u308B\u300D\u3067\u5B66\u671F\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
              ),
            };
          }
          const semesters = semestersRes.items.sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              ((b.created_at as string) ?? "").localeCompare(
                (a.created_at as string) ?? "",
              ),
          );
          return {
            response_action: "update" as const,
            view: buildViewProgressView(
              channel,
              semesters,
              (semesters.find((s) => s.status === "active")
                ?.semester_id) as string | undefined,
            ),
          };
        }

        case MenuAction.CloseSemester: {
          const semester = await fetchActiveSemester(client, userId);
          if (!semester) {
            return {
              response_action: "update" as const,
              view: buildInfoView(
                channel,
                "\u26A0\uFE0F \u7D42\u4E86\u3067\u304D\u308B\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u5B66\u671F\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
              ),
            };
          }
          return {
            response_action: "update" as const,
            view: buildCloseSemesterView(channel, semester),
          };
        }
      }
    },
  )
  // ----- Main menu / Info closed -----

  .addViewClosedHandler(
    [CallbackId.MainMenu, CallbackId.InfoView],
    async ({ body, client }) => {
      await completeQuietly(client, body.function_data.execution_id);
    },
  )
  // ----- Create Semester submission -----

  .addViewSubmissionHandler(
    CallbackId.CreateSemester,
    async ({ view, client, body }) => {
      const { channel } = JSON.parse(view.private_metadata!);
      const values = view.state.values;
      const year = Number(values.year_block.year_input.value);
      const season = values.season_block.season_select.selected_option!.value;
      const startDate = values.start_date_block.start_date_picker
        .selected_date!;
      const endDate = values.end_date_block.end_date_picker.selected_date!;
      const userId = body.user.id;

      const errors: Record<string, string> = {};
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        errors.year_block =
          "2000\u301C2100\u306E4\u6841\u306E\u897F\u66A6\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      }
      if (startDate >= endDate) {
        errors.end_date_block =
          "\u7D42\u4E86\u65E5\u306F\u958B\u59CB\u65E5\u3088\u308A\u5F8C\u306E\u65E5\u4ED8\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      }
      if (Object.keys(errors).length > 0) {
        return { response_action: "errors" as const, errors };
      }

      const existingRes = await client.apps.datastore.query<
        typeof SemestersDatastore.definition
      >({
        datastore: SemestersDatastore.definition.name,
        expression: "user_id = :uid AND #s = :active",
        expression_attributes: { "#s": "status" },
        expression_values: { ":uid": userId, ":active": "active" },
      });

      let warningMsg = "";
      if (existingRes.ok && existingRes.items.length > 0) {
        const existing = existingRes.items[0];
        warningMsg =
          `\n\u26A0\uFE0F \u65E2\u5B58\u306E\u30A2\u30AF\u30C6\u30A3\u30D6\u5B66\u671F\uFF08${existing.year}\u5E74 ${existing.season}\u5B66\u671F\uFF09\u304C\u3042\u308A\u307E\u3059\u3002`;
      }

      const semesterId = crypto.randomUUID();
      const putRes = await client.apps.datastore.put<
        typeof SemestersDatastore.definition
      >({
        datastore: SemestersDatastore.definition.name,
        item: {
          semester_id: semesterId,
          user_id: userId,
          year,
          season,
          start_date: startDate,
          end_date: endDate,
          status: "active",
          created_at: new Date().toISOString(),
          closed_at: "",
        },
      });

      if (!putRes.ok) {
        return {
          response_action: "errors" as const,
          errors: {
            year_block:
              `\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${putRes.error}`,
          },
        };
      }

      const msg =
        `\u2705 \u5B66\u671F\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F\uFF01${warningMsg}\n\n` +
        `\uD83D\uDCC5 ${year}\u5E74 ${season}\u5B66\u671F\n` +
        `\u2022 \u958B\u59CB\u65E5: ${startDate}\n` +
        `\u2022 \u7D42\u4E86\u65E5: ${endDate}\n\n` +
        `\u6B21\u306B\u300C\u79D1\u76EE\u3092\u8FFD\u52A0\u3059\u308B\u300D\u3067\u79D1\u76EE\u3092\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;

      await client.chat.postMessage({ channel, text: msg });
      await completeQuietly(client, body.function_data.execution_id);
      return { response_action: "clear" as const };
    },
  )
  .addViewClosedHandler(
    CallbackId.CreateSemester,
    async ({ body, client }) => {
      await completeQuietly(client, body.function_data.execution_id);
    },
  )
  // ----- Add Subject submission -----

  .addViewSubmissionHandler(
    CallbackId.AddSubject,
    async ({ view, client, body }) => {
      const metadata: AddSubjectMeta = JSON.parse(view.private_metadata!);
      const seq = metadata.form_seq;
      const values = view.state.values;
      const subjectName = values[`subject_name_block_${seq}`].subject_name_input
        .value!.trim();
      const credits = Number(
        values[`credits_block_${seq}`].credits_select.selected_option!.value,
      );
      const userId = body.user.id;

      if (subjectName.length === 0) {
        return {
          response_action: "errors" as const,
          errors: {
            [`subject_name_block_${seq}`]:
              "\u79D1\u76EE\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
          },
        };
      }

      const dupRes = await client.apps.datastore.query<
        typeof SubjectsDatastore.definition
      >({
        datastore: SubjectsDatastore.definition.name,
        expression: "semester_id = :sid AND subject_name = :name",
        expression_values: {
          ":sid": metadata.semester_id,
          ":name": subjectName,
        },
      });

      if (dupRes.ok && dupRes.items.length > 0) {
        return {
          response_action: "errors" as const,
          errors: {
            [`subject_name_block_${seq}`]:
              `\u79D1\u76EE\u300C${subjectName}\u300D\u306F\u3059\u3067\u306B\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u3059\u3002`,
          },
        };
      }

      const subjectId = crypto.randomUUID();
      const putRes = await client.apps.datastore.put<
        typeof SubjectsDatastore.definition
      >({
        datastore: SubjectsDatastore.definition.name,
        item: {
          subject_id: subjectId,
          semester_id: metadata.semester_id,
          user_id: userId,
          subject_name: subjectName,
          credits,
        },
      });

      if (!putRes.ok) {
        return {
          response_action: "errors" as const,
          errors: {
            [`subject_name_block_${seq}`]:
              `\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${putRes.error}`,
          },
        };
      }

      metadata.added_subjects.push({ name: subjectName, credits });
      metadata.form_seq = seq + 1;

      return {
        response_action: "update" as const,
        view: buildAddSubjectView(metadata),
      };
    },
  )
  .addViewClosedHandler(
    CallbackId.AddSubject,
    async ({ view, body, client }) => {
      const metadata: AddSubjectMeta = JSON.parse(view.private_metadata!);
      const added = metadata.added_subjects;

      if (added.length > 0) {
        const list = added
          .map((s) => `\u2022 ${s.name}\uFF08${s.credits}\u5358\u4F4D\uFF09`)
          .join("\n");
        const msg =
          `\u2705 ${added.length}\u79D1\u76EE\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F\uFF01\n\n` +
          `\uD83D\uDCC5 ${metadata.semester_year}\u5E74 ${metadata.semester_season}\u5B66\u671F\n` +
          list;
        await client.chat.postMessage({ channel: body.user.id, text: msg });
      }

      await completeQuietly(client, body.function_data.execution_id);
    },
  )
  // ----- Manage Subject submission -----

  .addViewSubmissionHandler(
    CallbackId.ManageSubject,
    async ({ view, client, body }) => {
      const metadata: ManageSubjectMeta = JSON.parse(view.private_metadata!);
      const seq = metadata.form_seq;
      const userId = body.user.id;

      if (metadata.mode === "list") {
        const values = view.state.values;
        const selectedSubject: SubjectItem = JSON.parse(
          values[`subject_select_block_${seq}`].subject_select.selected_option!
            .value,
        );
        const action =
          values[`action_block_${seq}`].action_select.selected_option!.value;

        if (action === "delete") {
          metadata.mode = "confirm_delete";
          metadata.deleting_subject = selectedSubject;
          metadata.form_seq = seq + 1;
          return {
            response_action: "update" as const,
            view: buildConfirmDeleteView(metadata),
          };
        }

        if (action === "edit") {
          metadata.mode = "edit";
          metadata.editing_subject = selectedSubject;
          metadata.form_seq = seq + 1;
          return {
            response_action: "update" as const,
            view: buildManageEditView(metadata),
          };
        }
      }

      if (metadata.mode === "edit" && metadata.editing_subject) {
        const values = view.state.values;
        const newName = values[`edit_name_block_${seq}`].edit_name_input.value!
          .trim();
        const newCredits = Number(
          values[`edit_credits_block_${seq}`].edit_credits_select
            .selected_option!.value,
        );

        if (newName.length === 0) {
          return {
            response_action: "errors" as const,
            errors: {
              [`edit_name_block_${seq}`]:
                "\u79D1\u76EE\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
            },
          };
        }

        const putRes = await client.apps.datastore.put<
          typeof SubjectsDatastore.definition
        >({
          datastore: SubjectsDatastore.definition.name,
          item: {
            subject_id: metadata.editing_subject.subject_id,
            semester_id: metadata.semester_id,
            user_id: userId,
            subject_name: newName,
            credits: newCredits,
          },
        });

        if (!putRes.ok) {
          return {
            response_action: "errors" as const,
            errors: {
              [`edit_name_block_${seq}`]:
                `\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${putRes.error}`,
            },
          };
        }

        const subjects = await querySubjects(client, metadata.semester_id);
        metadata.mode = "list";
        metadata.editing_subject = undefined;
        metadata.form_seq = seq + 1;

        return {
          response_action: "update" as const,
          view: buildManageListView(metadata, subjects),
        };
      }

      if (metadata.mode === "confirm_delete" && metadata.deleting_subject) {
        const target = metadata.deleting_subject;

        const delRes = await client.apps.datastore.delete<
          typeof SubjectsDatastore.definition
        >({
          datastore: SubjectsDatastore.definition.name,
          id: target.subject_id,
        });

        if (!delRes.ok) {
          await client.chat.postMessage({
            channel: body.user.id,
            text:
              `\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${delRes.error}`,
          });
          await completeQuietly(client, body.function_data.execution_id);
          return { response_action: "clear" as const };
        }

        await client.apps.datastore.delete<
          typeof ProgressDatastore.definition
        >({
          datastore: ProgressDatastore.definition.name,
          id: target.subject_id,
        });

        await client.chat.postMessage({
          channel: body.user.id,
          text:
            `\uD83D\uDDD1\uFE0F \u79D1\u76EE\u300C${target.subject_name}\u300D\u3068\u8A18\u9332\u6E08\u307F\u306E\u9032\u6357\u3092\u524A\u9664\u3057\u307E\u3057\u305F\u3002`,
        });

        const subjects = await querySubjects(client, metadata.semester_id);
        metadata.mode = "list";
        metadata.deleting_subject = undefined;
        metadata.form_seq = (metadata.form_seq ?? 0) + 1;

        if (subjects.length === 0) {
          await completeQuietly(client, body.function_data.execution_id);
          return { response_action: "clear" as const };
        }

        return {
          response_action: "update" as const,
          view: buildManageListView(metadata, subjects),
        };
      }

      return { response_action: "clear" as const };
    },
  )
  .addViewClosedHandler(
    CallbackId.ManageSubject,
    async ({ view, body, client }) => {
      const metadata: ManageSubjectMeta = JSON.parse(view.private_metadata!);
      const msg =
        `\uD83D\uDCCB ${metadata.semester_year}\u5E74 ${metadata.semester_season}\u5B66\u671F\u306E\u79D1\u76EE\u7BA1\u7406\u3092\u7D42\u4E86\u3057\u307E\u3057\u305F\u3002`;
      await client.chat.postMessage({ channel: body.user.id, text: msg });
      await completeQuietly(client, body.function_data.execution_id);
    },
  )
  // ----- Log Progress submission -----

  .addViewSubmissionHandler(
    CallbackId.LogProgress,
    async ({ view, client, body }) => {
      return await handleLogProgressSubmission(client, body.user.id, view);
    },
  )
  .addViewClosedHandler(
    CallbackId.LogProgress,
    async ({ view, body, client }) => {
      const metadata: LogProgressMeta = JSON.parse(view.private_metadata!);
      if (!metadata.finished) {
        const msg = await buildLogProgressSummary(metadata, client);
        if (msg) {
          await client.chat.postMessage({
            channel: metadata.channel,
            text: msg,
          });
        }
      }
      await completeQuietly(client, body.function_data.execution_id);
    },
  )
  // ----- View Progress submission -----

  .addViewSubmissionHandler(
    CallbackId.ViewProgress,
    async ({ view, client, body }) => {
      const semesterValue = JSON.parse(
        view.state.values.semester_block.semester_select.selected_option!.value,
      );

      const subjectsRes = await client.apps.datastore.query<
        typeof SubjectsDatastore.definition
      >({
        datastore: SubjectsDatastore.definition.name,
        expression: "semester_id = :sid",
        expression_values: { ":sid": semesterValue.semester_id },
      });

      if (!subjectsRes.ok || subjectsRes.items.length === 0) {
        await client.chat.postMessage({
          channel: body.user.id,
          text:
            "\u26A0\uFE0F \u3053\u306E\u5B66\u671F\u306B\u79D1\u76EE\u304C\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002",
        });
        await completeQuietly(client, body.function_data.execution_id);
        return { response_action: "clear" as const };
      }

      const subjects = subjectsRes.items;

      const progressRes = await client.apps.datastore.query<
        typeof ProgressDatastore.definition
      >({
        datastore: ProgressDatastore.definition.name,
        expression: "user_id = :uid",
        expression_values: { ":uid": body.user.id },
      });

      const progressMap = new Map(
        (progressRes.items ?? []).map((p: Record<string, unknown>) => [
          p.subject_id,
          p.progress_pct as number,
        ]),
      );

      const enriched = subjects.map((s: Record<string, unknown>) => {
        const pct = progressMap.get(s.subject_id as string);
        return {
          subject_name: s.subject_name as string,
          credits: s.credits as number,
          progress_pct: (pct ?? 0) as number,
          has_progress: pct !== undefined,
        };
      });

      const totalCredits = enriched.reduce((sum, s) => sum + s.credits, 0);
      const weightedProgress = totalCredits > 0
        ? round1(
          enriched.reduce((sum, s) => sum + s.credits * s.progress_pct, 0) /
            totalCredits,
        )
        : 0;

      const elapsedRate = semesterValue.status === "closed"
        ? 100
        : calcElapsedRate(semesterValue.start_date, semesterValue.end_date);

      const diff = round1(weightedProgress - elapsedRate);
      const diffStr = diff > 0
        ? `+${diff}% \u2705 \u9806\u8ABF\u3067\u3059\uFF01`
        : diff < 0
        ? `${diff}% \u26A0\uFE0F \u9045\u308C\u3066\u3044\u307E\u3059`
        : `\u00B10% \u2705 \u4E88\u5B9A\u901A\u308A\u3067\u3059`;

      const statusLabel = semesterValue.status === "active"
        ? "\u9032\u884C\u4E2D"
        : "\u7D42\u4E86";
      const today = getJstToday().toLocaleDateString("ja-JP");

      const subjectLines = enriched
        .map((s) => {
          const bar = renderBar(s.progress_pct);
          const pctLabel = s.has_progress ? `${s.progress_pct}%` : "N/A";
          return `  ${s.subject_name} (${s.credits}\u5358\u4F4D)  ${bar}  ${pctLabel}`;
        })
        .join("\n");

      const msg =
        `\uD83D\uDCDA \u9032\u6357\u4E00\u89A7\uFF08${today}\uFF09\n` +
        `\uD83D\uDCC5 ${semesterValue.year}\u5E74 ${semesterValue.season}\u5B66\u671F [${statusLabel}]\n\n` +
        `\u79D1\u76EE\u5225:\n${subjectLines}\n\n` +
        `\u5168\u4F53\u9032\u6357: ${weightedProgress}% ${
          renderBar(weightedProgress)
        }\n` +
        `\u7D4C\u904E\u6642\u9593: ${elapsedRate}% ${
          renderBar(elapsedRate)
        }\n` +
        `\u5DEE\u5206: ${diffStr}`;

      await client.chat.postMessage({ channel: body.user.id, text: msg });
      await completeQuietly(client, body.function_data.execution_id);
      return { response_action: "clear" as const };
    },
  )
  .addViewClosedHandler(
    CallbackId.ViewProgress,
    async ({ body, client }) => {
      await completeQuietly(client, body.function_data.execution_id);
    },
  )
  // ----- Close Semester submission -----

  .addViewSubmissionHandler(
    CallbackId.CloseSemester,
    async ({ view, client, body }) => {
      const metadata = JSON.parse(view.private_metadata!);
      const userId = body.user.id;

      const subjectsRes = await client.apps.datastore.query<
        typeof SubjectsDatastore.definition
      >({
        datastore: SubjectsDatastore.definition.name,
        expression: "semester_id = :sid",
        expression_values: { ":sid": metadata.semester_id },
      });

      const progressRes = await client.apps.datastore.query<
        typeof ProgressDatastore.definition
      >({
        datastore: ProgressDatastore.definition.name,
        expression: "user_id = :uid",
        expression_values: { ":uid": userId },
      });

      const progressMap = new Map(
        (progressRes.items ?? []).map((p: Record<string, unknown>) => [
          p.subject_id,
          p.progress_pct as number,
        ]),
      );

      const subjects = subjectsRes.items ?? [];
      const enriched = subjects.map((s: Record<string, unknown>) => {
        const pct = progressMap.get(s.subject_id as string);
        return {
          subject_name: s.subject_name as string,
          credits: s.credits as number,
          progress_pct: (pct ?? 0) as number,
          has_progress: pct !== undefined,
        };
      });

      const totalCredits = enriched.reduce((sum, s) => sum + s.credits, 0);
      const weightedProgress = totalCredits > 0
        ? round1(
          enriched.reduce((sum, s) => sum + s.credits * s.progress_pct, 0) /
            totalCredits,
        )
        : 0;

      const closedAt = new Date().toISOString();
      await client.apps.datastore.put<typeof SemestersDatastore.definition>({
        datastore: SemestersDatastore.definition.name,
        item: {
          semester_id: metadata.semester_id,
          user_id: userId,
          year: metadata.year,
          season: metadata.season,
          start_date: "",
          end_date: metadata.end_date,
          status: "closed",
          created_at: "",
          closed_at: closedAt,
        },
      });

      const subjectLines = enriched
        .map((s) => {
          const bar = renderBar(s.progress_pct);
          const pctLabel = s.has_progress ? `${s.progress_pct}%` : "N/A";
          return `  ${s.subject_name} (${s.credits}\u5358\u4F4D)  ${bar}  ${pctLabel}`;
        })
        .join("\n");

      const finalStatus = weightedProgress >= 80
        ? "\u2705 \u3088\u304F\u9811\u5F35\u308A\u307E\u3057\u305F\uFF01"
        : weightedProgress >= 60
        ? "\uD83D\uDC4D \u304A\u75B2\u308C\u69D8\u3067\u3057\u305F\uFF01"
        : "\uD83D\uDCDD \u304A\u75B2\u308C\u69D8\u3067\u3057\u305F\u3002\u6B21\u5B66\u671F\u3082\u9811\u5F35\u308A\u307E\u3057\u3087\u3046\uFF01";

      const closedDateLabel = new Date(closedAt).toLocaleDateString("ja-JP");
      const msg =
        `\uD83C\uDF93 ${metadata.year}\u5E74 ${metadata.season}\u5B66\u671F \u2014 \u6700\u7D42\u30EC\u30DD\u30FC\u30C8\n\n` +
        (enriched.length > 0
          ? `\u79D1\u76EE\u5225\u6700\u7D42\u9032\u6357:\n${subjectLines}\n\n`
          : "\uFF08\u79D1\u76EE\u306E\u767B\u9332\u306A\u3057\uFF09\n\n") +
        `\u6700\u7D42\u52A0\u91CD\u5E73\u5747: ${weightedProgress}% ${
          renderBar(weightedProgress)
        }\n` +
        `\u5B66\u671F\u7D42\u4E86\u65E5: ${closedDateLabel}\n\n` +
        finalStatus;

      await client.chat.postMessage({ channel: metadata.channel, text: msg });
      await completeQuietly(client, body.function_data.execution_id);
      return { response_action: "clear" as const };
    },
  )
  .addViewClosedHandler(
    CallbackId.CloseSemester,
    async ({ body, client }) => {
      await completeQuietly(client, body.function_data.execution_id);
    },
  )
  // ----- Back to Home -----

  .addBlockActionsHandler(
    ActionId.LogProgressAndFinish,
    async ({ body, client }) => {
      await handleLogProgressAndFinish(client, body.user.id, body, {
        includeHomeButton: true,
      });
    },
  )
  .addBlockActionsHandler(
    ActionId.BackToHome,
    async ({ body, client }) => {
      const channel = JSON.parse(body.view.private_metadata!).channel;
      await client.views.update({
        view_id: body.view.id,
        view: buildMainMenuView(channel),
      });
    },
  );
