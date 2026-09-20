import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./details_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { hasPendingReview } from "../../../helpers/contentReviewQueue";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const input = schema.parse({
      liveTestId: url.searchParams.get("liveTestId"),
    });

    const liveTest = await db
      .selectFrom("liveTests")
      .selectAll()
      .where("id", "=", input.liveTestId)
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(superjson.stringify({ error: "Live test not found" }), { status: 404 });
    }

    if (liveTest.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "You do not own this live test" }), { status: 403 });
    }

    const mockTest = await db
      .selectFrom("mockTests")
      .selectAll()
      .where("id", "=", liveTest.mockTestId)
      .executeTakeFirst();

    const mockTestItem = await db
      .selectFrom("mockTestItems")
      .selectAll()
      .where("packageId", "=", liveTest.mockTestId)
      .executeTakeFirst();

    let subjects: OutputType["subjects"] = [];
    if (mockTestItem) {
      subjects = await db
        .selectFrom("testItemSubjects")
        .leftJoin("testQuestions", "testQuestions.subjectId", "testItemSubjects.id")
        .select([
          "testItemSubjects.id",
          "testItemSubjects.testItemId",
          "testItemSubjects.subjectName",
          "testItemSubjects.orderIndex",
          "testItemSubjects.createdAt",
          "testItemSubjects.description",
          "testItemSubjects.durationMinutes",
          "testItemSubjects.maxAttemptsAllowed",
          sql<number>`COUNT(test_questions.id)::int`.as("actualQuestionCount"),
        ])
        .where("testItemSubjects.testItemId", "=", mockTestItem.id)
        .groupBy(["testItemSubjects.id"])
        .orderBy("testItemSubjects.orderIndex", "asc")
        .execute() as unknown as OutputType["subjects"];
    }

    const output: OutputType = {
      ...liveTest,
      mockTest: mockTest || null,
      mockTestItem: mockTestItem || null,
      subjects: subjects,
      inReview: await hasPendingReview(db, "live_test", liveTest.id),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching live test details:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "An unknown error occurred" }), { status: 500 });
  }
}