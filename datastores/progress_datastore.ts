import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const ProgressDatastore = DefineDatastore({
  name: "Progress",
  primary_key: "subject_id",
  attributes: {
    subject_id: {
      type: Schema.types.string,
    },
    user_id: {
      type: Schema.types.string,
    },
    progress_pct: {
      type: Schema.types.number,
    },
    updated_at: {
      type: Schema.types.string,
    },
  },
});

export default ProgressDatastore;
