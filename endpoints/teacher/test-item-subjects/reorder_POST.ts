import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reorder_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../../helpers/schema";

async function reorderSubjects(
  items: { subjectId: number; orderIndex: number }[],
  trx: Transaction<DB>
) {
  const updatePromises = items.map((item) =>
    trx
      .updateTable("testItemSubjects")
      .set({ orderIndex: item.orderIndex })
      .where("id", "=", item.subjectId)
      .execute()
  );
  await Promise.all(updatePromises);
}

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

    if (input.items.length === 0) {
      return new Response(
        superjson.stringify({
          success: true,
          message: "No subjects to reorder.",
        } satisfies OutputType)
      );
    }

    const subjectIds = input.items.map((item) => item.subjectId);

    await db.transaction().execute(async (trx) => {
      const dbItems = await trx
        .selectFrom("testItemSubjects")
        .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
        .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
        .select([
          "testItemSubjects.id",
          "testItemSubjects.testItemId",
          "mockTests.teacherId",
        ])
        .where("testItemSubjects.id", "in", subjectIds)
        .execute();

      if (dbItems.length !== subjectIds.length) {
        throw new Error("One or more subjects not found.");
      }

      if (dbItems.length > 0) {
        const firstItem = dbItems[0];
        const ownerId = firstItem.teacherId;
        const testItemId = firstItem.testItemId;

        if (ownerId !== effectiveTeacherId && user.role !== "admin") {
          throw new Error("You do not have permission to reorder these subjects.");
        }

        for (const item of dbItems) {
          if (item.testItemId !== testItemId) {
            throw new Error("All subjects must belong to the same test item.");
          }
        }
      }

      await reorderSubjects(input.items, trx);
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Subjects reordered successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error reordering test item subjects:", error);
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