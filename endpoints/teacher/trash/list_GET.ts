import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    // 1. Fetch trashed mock test packages
    const trashedTestsData = await db
      .selectFrom("mockTests")
      .select([
        "id",
        "title",
        "slug",
        "examName",
        "totalTests",
        "totalQuestions",
        "price",
        "studentsEnrolled",
        "isPublished",
        "wasEverPublished",
        "deletedAt",
        "createdAt",
      ])
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM mock_test_items
          WHERE mock_test_items.package_id = mock_tests.id
        )`.as("testItemsCount"),
      ])
      .where("teacherId", "=", effectiveTeacherId)
      .where("deletedAt", "is not", null)
      .orderBy("deletedAt", "desc")
      .execute();

    // 2. Fetch individually trashed test items (belonging to non-trashed packages)
    const trashedTestItemsData = await db
      .selectFrom("mockTestItems")
      .innerJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
      .select([
        "mockTestItems.id",
        "mockTestItems.title",
        "mockTestItems.subject",
        "mockTestItems.durationMinutes",
        "mockTestItems.totalQuestions",
        "mockTestItems.deletedAt",
        "mockTests.id as parentTestId",
        "mockTests.title as parentTestTitle",
      ])
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM test_questions
          WHERE test_questions.test_id = mock_test_items.id
        )`.as("questionsCount"),
      ])
      .where("mockTestItems.deletedAt", "is not", null)
      .where("mockTests.teacherId", "=", effectiveTeacherId)
      .where("mockTests.deletedAt", "is", null)
      .orderBy("mockTestItems.deletedAt", "desc")
      .execute();

    const now = Date.now();

    const trashedTests = trashedTestsData.map((test) => {
      const deletedTime = test.deletedAt ? test.deletedAt.getTime() : now;
      const daysSinceDeleted = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 30 - daysSinceDeleted);

      return {
        ...test,
        price: Number(test.price),
        testItemsCount: Number(test.testItemsCount),
        daysRemaining,
      };
    });

    const trashedTestItems = trashedTestItemsData.map((item) => {
      const deletedTime = item.deletedAt ? item.deletedAt.getTime() : now;
      const daysSinceDeleted = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 30 - daysSinceDeleted);

      return {
        id: item.id,
        title: item.title,
        subject: item.subject,
        durationMinutes: item.durationMinutes,
        totalQuestions: item.totalQuestions,
        deletedAt: item.deletedAt,
        daysRemaining,
        parentTestId: item.parentTestId,
        parentTestTitle: item.parentTestTitle,
        questionsCount: Number(item.questionsCount),
      };
    });

    const output: OutputType = { trashedTests, trashedTestItems };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing trashed tests:", error);
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