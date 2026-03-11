import { Manifest } from "deno-slack-sdk/mod.ts";
import LearnLogWorkflow from "./workflows/sample_workflow.ts";
import LearningLogDatastore from "./datastores/sample_datastore.ts";

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
  workflows: [LearnLogWorkflow],
  outgoingDomains: [],
  datastores: [LearningLogDatastore],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
  ],
});
