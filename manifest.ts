import { Manifest } from "deno-slack-sdk/mod.ts";
import LearnLoggerWorkflow from "./workflows/learn_logger.ts";
import SemestersDatastore from "./datastores/semesters_datastore.ts";
import SubjectsDatastore from "./datastores/subjects_datastore.ts";
import ProgressDatastore from "./datastores/progress_datastore.ts";

export default Manifest({
  name: "learn logger",
  displayName: "learn logger",
  description: "learn logger",
  icon: "assets/default_new_app_icon.png",
  workflows: [LearnLoggerWorkflow],
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
