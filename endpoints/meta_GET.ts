import { schema, OutputType } from "./meta_GET.schema";
import superjson from "superjson";
import { db } from "../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const fieldsParam = url.searchParams.get("fields");

    // Parse the query parameter (fields is now optional)
    const input = schema.parse({ fields: fieldsParam ?? undefined });

    const fieldsArray = input.fields
      ? input.fields
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f.length > 0)
      : [];

    if (fieldsArray.length === 0) {
      // No fields specified — return ALL rows from meta table
      console.log("meta_GET: no fields specified, returning all meta rows");
      const rows = await db
        .selectFrom("meta")
        .select(["field", "value"])
        .execute();

      const output: OutputType = {};
      for (const row of rows) {
        output[row.field] = row.value;
      }

      return new Response(superjson.stringify(output satisfies OutputType));
    }

    // Query the database for the requested fields
    const rows = await db
      .selectFrom("meta")
      .select(["field", "value"])
      .where("field", "in", fieldsArray)
      .execute();

    // Initialize the output map with nulls for all requested fields
    const output: OutputType = {};
    for (const field of fieldsArray) {
      output[field] = null;
    }

    // Populate the output map with the found values
    for (const row of rows) {
      output[row.field] = row.value;
    }

    return new Response(superjson.stringify(output satisfies OutputType));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}