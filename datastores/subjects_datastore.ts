import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const SubjectsDatastore = DefineDatastore({
  name: "Subjects",
  primary_key: "subject_id",
  attributes: {
    subject_id: {
      type: Schema.types.string,
    },
    semester_id: {
      type: Schema.types.string,
    },
    user_id: {
      type: Schema.types.string,
    },
    subject_name: {
      type: Schema.types.string,
    },
    credits: {
      type: Schema.types.number,
    },
  },
});

export default SubjectsDatastore;
