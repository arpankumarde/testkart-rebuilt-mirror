import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const parentPackage = await db
      .selectFrom("mockTests")
      .select("teacherId")
      .where("id", "=", input.packageId)
      .executeTakeFirst();

    if (!parentPackage) {
      return new Response(
        superjson.stringify({ error: "Package not found" }),
        { status: 404 }
      );
    }

    if (parentPackage.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this package" }),
        { status: 403 }
      );
    }

    // Query the maximum orderIndex for items in this package
    const maxOrderIndexResult = await db
      .selectFrom("mockTestItems")
      .select(db.fn.max("orderIndex").as("maxOrderIndex"))
      .where("packageId", "=", input.packageId)
      .executeTakeFirst();

    // Set new item's orderIndex to max + 1, or 0 if no items exist
    const nextOrderIndex = maxOrderIndexResult?.maxOrderIndex != null 
      ? maxOrderIndexResult.maxOrderIndex + 1 
      : 0;

    // Only live items hold a title. Trash restore renames an item whose title
    // has been reused in the meantime, so a trashed item never blocks a name.
    const conflictingItem = await db
      .selectFrom("mockTestItems")
      .select("id")
      .where("packageId", "=", input.packageId)
      .where("title", "=", input.title)
      .where("deletedAt", "is", null)
      .executeTakeFirst();

    if (conflictingItem) {
      return new Response(
        superjson.stringify({ error: `A test item named "${input.title}" already exists in this test series.` }),
        { status: 400 }
      );
    }

    const newItem = await db
      .insertInto("mockTestItems")
      .values({
        ...input,
        subject: input.subject || "",
        description: input.description || null,
        calculatorEnabled: input.calculatorEnabled,
        orderIndex: nextOrderIndex,
        scheduledDate: input.scheduledDate ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

        await syncMockTestAggregates(input.packageId).catch(err => console.error("Failed to sync aggregates:", err));

    return new Response(superjson.stringify(newItem satisfies OutputType));
  } catch (error) {
    console.error("Error creating test item:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}