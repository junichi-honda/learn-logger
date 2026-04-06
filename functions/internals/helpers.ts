import SemestersDatastore from "../../datastores/semesters_datastore.ts";

// deno-lint-ignore no-explicit-any
export async function fetchActiveSemester(client: any, userId: string) {
  const res = await client.apps.datastore.query({
    datastore: SemestersDatastore.definition.name,
    expression: "user_id = :uid AND #s = :active",
    expression_attributes: { "#s": "status" },
    expression_values: { ":uid": userId, ":active": "active" },
  });
  if (!res.ok || res.items.length === 0) return null;
  return res.items[0];
}

// deno-lint-ignore no-explicit-any
export async function completeQuietly(client: any, executionId: string) {
  await client.functions.completeSuccess({
    function_execution_id: executionId,
    outputs: {},
  });
}
