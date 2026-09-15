import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const tests = await db
      .selectFrom("mockTests")
      .leftJoin("exams", "mockTests.examId", "exams.id")
      .selectAll("mockTests")
      .select("exams.examSlug")
      .select((eb) => [
        sql<number>`(
                    SELECT COUNT(*)
          FROM mock_test_items
          WHERE mock_test_items.package_id = mock_tests.id
          AND mock_test_items.deleted_at IS NULL
        )`.as("testItemsCount"),
      ])
      .where("mockTests.teacherId", "=", effectiveTeacherId)
      .where("mockTests.deletedAt", "is", null)
      .orderBy("mockTests.createdAt", "desc")
      .execute();

    const output: OutputType = tests.map((test) => ({
      ...test,
      price: Number(test.price),
      rating: test.rating ? Number(test.rating) : null,
      testItemsCount: Number(test.testItemsCount),
      examSlug: test.examSlug ?? null,
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing teacher tests:", error);
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