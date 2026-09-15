import { db } from "../../helpers/db";
import { OutputType } from "./popular-with-tests_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const popularExams = await db
      .selectFrom("exams")
      .innerJoin("mockTests", "mockTests.examId", "exams.id")
      .select([
        "exams.id",
        "exams.examName",
        "exams.examSlug",
        // The count function in kysely with postgres returns a bigint, which is serialized as a string.
        // We need to cast it to an integer to ensure it's a number in the final JSON.
        sql<number>`COUNT(mock_tests.id)::int`.as("seriesCount"),
      ])
      .where("mockTests.isPublished", "=", true)
      .groupBy(["exams.id", "exams.examName", "exams.examSlug"])
      .orderBy("seriesCount", "desc")
      .orderBy("exams.examName", "asc")
      .limit(24) // Limit to top 24 popular exams
      .execute();

    return new Response(
      superjson.stringify({
        exams: popularExams,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error(
      "[exams/popular-with-tests_GET] Error fetching popular exams:",
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}