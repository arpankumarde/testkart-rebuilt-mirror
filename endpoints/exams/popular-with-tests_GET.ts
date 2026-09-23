import { db } from "../../helpers/db";
import { OutputType, PopularExam } from "./popular-with-tests_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    // A series counts once under every exam it is listed under (primary or other); UNION drops the
    // pair a join row repeats. COUNT is cast to int so it serializes as a number, not a bigint string.
    const { rows: popularExams } = await sql<PopularExam>`
      WITH listed AS (
        SELECT mt.id AS mock_test_id, mt.exam_id FROM mock_tests mt
        WHERE mt.is_published = true AND mt.exam_id IS NOT NULL
        UNION
        SELECT mte.mock_test_id, mte.exam_id FROM mock_test_exams mte
        JOIN mock_tests mt ON mt.id = mte.mock_test_id
        WHERE mt.is_published = true AND mte.exam_id IS NOT NULL
      )
      SELECT e.id, e.exam_name, e.exam_slug, COUNT(*)::int AS series_count
      FROM exams e
      JOIN listed l ON l.exam_id = e.id
      GROUP BY e.id, e.exam_name, e.exam_slug
      ORDER BY series_count DESC, e.exam_name ASC
      LIMIT 24
    `.execute(db);

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