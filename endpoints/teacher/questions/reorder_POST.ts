import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./reorder_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../../helpers/schema";

async function reorderQuestions(
  items: { questionId: number; orderIndex: number }[],
  trx: Transaction<DB>
) {
  const updatePromises = items.map((item) =>
    trx
      .updateTable("testQuestions")
      .set({ orderIndex: item.orderIndex })
      .where("id", "=", item.questionId)
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
          message: "No questions to reorder.",
        } satisfies OutputType)
      );
    }

    const questionIds = input.items.map((item) => item.questionId);

    await db.transaction().execute(async (trx) => {
      const dbItems = await trx
        .selectFrom("testQuestions")
        .innerJoin("testItemSubjects", "testQuestions.subjectId", "testItemSubjects.id")
        .innerJoin("mockTestItems", "testItemSubjects.testItemId", "mockTestItems.id")
        .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
        .select([
          "testQuestions.id",
          "testQuestions.subjectId",
          "mockTests.teacherId",
        ])
        .where("testQuestions.id", "in", questionIds)
        .execute();

      if (dbItems.length !== questionIds.length) {
        throw new Error("One or more questions not found or do not belong to a subject.");
      }

      if (dbItems.length > 0) {
        const firstItem = dbItems[0];
        const ownerId = firstItem.teacherId;
        const subjectId = firstItem.subjectId;

        if (ownerId !== effectiveTeacherId && user.role !== "admin") {
          throw new Error("You do not have permission to reorder these questions.");
        }

        for (const item of dbItems) {
          if (item.subjectId !== subjectId) {
            throw new Error("All questions must belong to the same subject.");
          }
        }
      }

      await reorderQuestions(input.items, trx);
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Questions reordered successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error reordering questions:", error);
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