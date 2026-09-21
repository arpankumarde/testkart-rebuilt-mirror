import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { OutputType, schema } from "./sync_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    // 1. Check admin session
    await getAdminServerSessionOrThrow(request);

    const text = await request.text();
    const json = text ? superjson.parse(text) : {};
    schema.parse(json);

    // 2 & 3. Insert users with role='teacher' who don't have a matching row into sales_contacts
    const result = await db
      .insertInto("salesContacts")
      .columns(["userId", "stage"])
      .expression((eb) =>
        eb
          .selectFrom("users")
          .leftJoin("salesContacts", "users.id", "salesContacts.userId")
          .select(["users.id as userId", sql<"new">`'new'`.as("stage")])
          .where("users.role", "=", "teacher")
          .where("salesContacts.id", "is", null)
      )
      .executeTakeFirst();

    // 4. Return success and synced count
    const syncedCount = Number(result.numInsertedOrUpdatedRows ?? 0);

    return new Response(
      superjson.stringify({
        success: true,
        syncedCount,
      } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error syncing sales contacts:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status:
          error instanceof Error && error.message.includes("Access denied")
            ? 403
            : 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}