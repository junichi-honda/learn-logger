import { Manifest } from "deno-slack-sdk/mod.ts";
import SemesterSetupWorkflow from "./workflows/semester_setup_workflow.ts";
import SubjectSetupWorkflow from "./workflows/subject_setup_workflow.ts";
import LogProgressWorkflow from "./workflows/log_progress_workflow.ts";
import ViewProgressWorkflow from "./workflows/view_progress_workflow.ts";
import SemesterCloseWorkflow from "./workflows/semester_close_workflow.ts";
import ManageSubjectWorkflow from "./workflows/manage_subject_workflow.ts";
import SemestersDatastore from "./datastores/semesters_datastore.ts";
import SubjectsDatastore from "./datastores/subjects_datastore.ts";
import ProgressDatastore from "./datastores/progress_datastore.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "learn logger",
  displayName: "learn logger",
  description: "learn logger",
  icon: "assets/default_new_app_icon.png",
  workflows: [
    SemesterSetupWorkflow,
    SubjectSetupWorkflow,
    LogProgressWorkflow,
    ViewProgressWorkflow,
    SemesterCloseWorkflow,
    ManageSubjectWorkflow,
  ],
  outgoingDomains: [],
  datastores: [
    SemestersDatastore,
    SubjectsDatastore,
    ProgressDatastore,
  ],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
  ],
});
