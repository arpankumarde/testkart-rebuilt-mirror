import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reorder_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../../helpers/schema";

async function reorderSections(
  items: { sectionId: number; orderIndex: number }[],
  trx: Transaction<DB>
) {
  const updatePromises = items.map((item) =>
    trx
      .updateTable("subjectSections")
      .set({ orderIndex: item.orderIndex })
      .where("id", "=", item.sectionId)
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
          message: "No sections to reorder.",
        } satisfies OutputType)
      );
    }

    const sectionIds = input.items.map((item) => item.sectionId);

    await db.transaction().execute(async (trx) => {
      const dbItems = await trx
        .selectFrom("subjectSections")
        .innerJoin("testItemSubjects", "subjectSections.subjectId", "testItemSubjects.id")
        .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
        .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
        .select([
          "subjectSections.id",
          "subjectSections.subjectId",
          "mockTests.teacherId",
        ])
        .where("subjectSections.id", "in", sectionIds)
        .execute();

      if (dbItems.length !== sectionIds.length) {
        throw new Error("One or more sections not found.");
      }

      if (dbItems.length > 0) {
        const firstItem = dbItems[0];
        const ownerId = firstItem.teacherId;
        const targetSubjectId = firstItem.subjectId;

        if (ownerId !== effectiveTeacherId && user.role !== "admin") {
          throw new Error("You do not have permission to reorder these sections.");
        }

        for (const item of dbItems) {
          if (item.subjectId !== targetSubjectId) {
            throw new Error("All sections must belong to the same subject.");
          }
        }
      }

      await reorderSections(input.items, trx);
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Sections reordered successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error reordering subject sections:", error);
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