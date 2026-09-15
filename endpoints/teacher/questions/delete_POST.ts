import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./delete_POST.schema";
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

    const questionAndOwner = await db
      .selectFrom("testQuestions")
      .innerJoin(
        "mockTestItems",
        "testQuestions.testId",
        "mockTestItems.id"
      )
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .select(["mockTests.teacherId", "mockTests.id as mockTestId"])
      .where("testQuestions.id", "=", input.questionId)
      .executeTakeFirst();

    if (!questionAndOwner) {
      return new Response(
        superjson.stringify({ error: "Question not found" }),
        { status: 404 }
      );
    }

    if (questionAndOwner.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this question" }),
        { status: 403 }
      );
    }

    // Delete corresponding question bank entry before test question deletion
    // (FK ON DELETE SET NULL would null out the reference after test question is deleted)
    try {
      await db.deleteFrom("questionBank")
        .where("sourceTestQuestionId", "=", input.questionId)
        .execute();
    } catch (err) {
      console.error(
        "[delete_POST] Failed to delete question bank entry:",
        err instanceof Error ? err.message : String(err)
      );
    }

    const result = await db
      .deleteFrom("testQuestions")
      .where("id", "=", input.questionId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      return new Response(
        superjson.stringify({ error: "Question not found or already deleted" }),
        { status: 404 }
      );
    }

        await syncMockTestAggregates(questionAndOwner.mockTestId).catch(err => console.error("Failed to sync aggregates:", err));

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error deleting question:", error);
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