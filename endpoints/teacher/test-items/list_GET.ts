import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized: Access denied" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const packageId = url.searchParams.get("packageId");

    const validatedInput = schema.parse({ packageId });

    // Verify that the teacher owns the package
    const mockTestPackage = await db
      .selectFrom("mockTests")
      .select("id")
      .where("id", "=", validatedInput.packageId)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!mockTestPackage) {
      return new Response(
        superjson.stringify({
          error: "Mock test package not found or you do not have permission to access it.",
        }),
        { status: 404 }
      );
    }

    const testItems = await db
      .selectFrom("mockTestItems")
      .selectAll("mockTestItems")
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM test_questions
          WHERE test_questions.test_id = mock_test_items.id
             OR test_questions.subject_id IN (
               SELECT id FROM test_item_subjects WHERE test_item_id = mock_test_items.id
             )
        )`.as("questionsCount"),
        sql<number | null>`(
          SELECT SUM(COALESCE(duration_minutes, 20))
          FROM test_item_subjects
          WHERE test_item_subjects.test_item_id = mock_test_items.id
        )`.as("totalSubjectDurationMinutes"),
        sql<number>`(
          SELECT COUNT(*)
          FROM test_item_subjects
          WHERE test_item_subjects.test_item_id = mock_test_items.id
        )`.as("subjectsCount"),
        sql<number | null>`(
          SELECT SUM(COALESCE(duration_seconds, 60))
          FROM test_questions
          WHERE test_questions.test_id = mock_test_items.id
             OR test_questions.subject_id IN (
               SELECT id FROM test_item_subjects WHERE test_item_id = mock_test_items.id
             )
        )`.as("totalQuestionDurationSeconds"),
        sql<number>`(
          SELECT COUNT(*)
          FROM test_questions tq
          WHERE (
            tq.test_id = mock_test_items.id
            OR tq.subject_id IN (SELECT id FROM test_item_subjects WHERE test_item_id = mock_test_items.id)
          )
          AND (
            (tq.question_type IN ('single_correct_mcq', 'assertion_reason', 'comprehension') AND (tq.correct_option IS NULL OR tq.correct_option = ''))
            OR (tq.question_type = 'multiple_correct_mcq' AND (tq.correct_options IS NULL OR cardinality(tq.correct_options) = 0))
            OR (tq.question_type = 'numerical' AND tq.numerical_answer IS NULL)
          )
        )`.as("missingAnswerCount"),
        sql<number | null>`(
          SELECT MIN(sub_count) FROM (
            SELECT COUNT(tq.id) AS sub_count
            FROM test_item_subjects tis
            LEFT JOIN test_questions tq ON tq.subject_id = tis.id
            WHERE tis.test_item_id = mock_test_items.id
            GROUP BY tis.id
          ) x
        )`.as("minSubjectQuestionCount"),
        sql<number | null>`(
          SELECT MAX(sub_count) FROM (
            SELECT COUNT(tq.id) AS sub_count
            FROM test_item_subjects tis
            LEFT JOIN test_questions tq ON tq.subject_id = tis.id
            WHERE tis.test_item_id = mock_test_items.id
            GROUP BY tis.id
          ) x
        )`.as("maxSubjectQuestionCount"),
      ])
      .where("mockTestItems.packageId", "=", validatedInput.packageId)
      .where("mockTestItems.deletedAt", "is", null)
      .orderBy("mockTestItems.orderIndex", "asc")
      .execute();

    const output: OutputType = testItems.map((item) => ({
      ...item,
      questionsCount: Number(item.questionsCount),
      totalSubjectDurationMinutes:
        item.totalSubjectDurationMinutes != null
          ? Number(item.totalSubjectDurationMinutes)
          : null,
      subjectsCount: Number(item.subjectsCount),
      totalQuestionDurationMinutes:
        item.totalQuestionDurationSeconds != null
          ? Math.round(Number(item.totalQuestionDurationSeconds) / 60)
          : null,
      missingAnswerCount: Number(item.missingAnswerCount),
      minSubjectQuestionCount:
        item.minSubjectQuestionCount != null ? Number(item.minSubjectQuestionCount) : null,
      maxSubjectQuestionCount:
        item.maxSubjectQuestionCount != null ? Number(item.maxSubjectQuestionCount) : null,
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching test items:", error);
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Authentication required" }), {
        status: 401,
      });
    }
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