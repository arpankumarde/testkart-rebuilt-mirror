import { db } from "../../helpers/db";
import { sql } from "kysely";
import { schema, OutputType } from "./counts_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const input = schema.parse({
      examSlug: url.searchParams.get("examSlug") ?? "",
    });

    const exam = await db
      .selectFrom("exams")
      .select("id")
      .where("examSlug", "=", input.examSlug)
      .executeTakeFirst();

    if (!exam) {
      return new Response(
        superjson.stringify({
          examId: null,
          counts: { mockTests: 0, digitalProducts: 0, courses: 0, bundles: 0 },
        } satisfies OutputType)
      );
    }

    const examId = exam.id;

    const [mockTestsResult, digitalProductsResult, coursesResult, bundlesResult] = await Promise.all([
      db
        .selectFrom("mockTests")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("examId", "=", examId)
        .where("isPublished", "=", true)
        .where("deletedAt", "is", null)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb.selectFrom('liveTests')
                .select('liveTests.id')
                .whereRef('liveTests.mockTestId', '=', 'mockTests.id')
            )
          )
        )
        .executeTakeFirst(),
      db
        .selectFrom("digitalProducts")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("examId", "=", examId)
        .where("status", "=", "published")
        .where("isPublished", "=", true)
        .executeTakeFirst(),
      db
        .selectFrom("courses")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("examId", "=", examId)
        .where("status", "=", "published")
        .executeTakeFirst(),
      db
        .selectFrom("courseBundles")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("isPublished", "=", true)
        .where(
          sql<boolean>`EXISTS (
            SELECT 1 FROM course_bundle_items cbi
            LEFT JOIN mock_tests mt ON mt.id = cbi.mock_test_id
            LEFT JOIN digital_products dp ON dp.id = cbi.digital_product_id
            LEFT JOIN courses c ON c.id = cbi.course_id
            WHERE cbi.bundle_id = course_bundles.id
              AND (mt.exam_id = ${examId} OR dp.exam_id = ${examId} OR c.exam_id = ${examId})
          )`
        )
        .executeTakeFirst(),
    ]);

    const output: OutputType = {
      examId,
      counts: {
        mockTests: Number(mockTestsResult?.count ?? 0),
        digitalProducts: Number(digitalProductsResult?.count ?? 0),
        courses: Number(coursesResult?.count ?? 0),
        bundles: Number(bundlesResult?.count ?? 0),
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("[exam-products/counts_GET] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
