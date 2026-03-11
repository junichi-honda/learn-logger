import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const SemestersDatastore = DefineDatastore({
  name: "Semesters",
  primary_key: "semester_id",
  attributes: {
    semester_id: {
      type: Schema.types.string,
    },
    user_id: {
      type: Schema.types.string,
    },
    year: {
      type: Schema.types.number,
    },
    season: {
      type: Schema.types.string,
    },
    start_date: {
      type: Schema.types.string,
    },
    end_date: {
      type: Schema.types.string,
    },
    status: {
      type: Schema.types.string,
    },
    created_at: {
      type: Schema.types.string,
    },
    closed_at: {
      type: Schema.types.string,
    },
  },
});

export default SemestersDatastore;
