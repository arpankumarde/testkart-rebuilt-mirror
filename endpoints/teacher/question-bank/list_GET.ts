import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType, QuestionBankWithMeta } from "./list_GET.schema";
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

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const input = schema.parse(queryParams);

    let query = db
      .selectFrom("questionBank")
      .leftJoin("mockTests", "questionBank.sourceMockTestId", "mockTests.id")
      .leftJoin("mockTestItems", "questionBank.sourceTestItemId", "mockTestItems.id")
      .where("questionBank.teacherId", "=", effectiveTeacherId);

    if (input.search) {
      query = query.where("questionBank.questionText", "ilike", `%${input.search}%`);
    }
    if (input.sourceMockTestId !== undefined) {
      // Filter by source_test_question_id matching test questions in the mock test series,
      // with fallback OR on source_mock_test_id for backward compatibility with unmigrated entries
            query = query.where(
        sql`(question_bank.source_test_question_id IN (
          SELECT tq.id FROM test_questions tq
          JOIN test_item_subjects tis ON tq.subject_id = tis.id
          JOIN mock_test_items mti ON tis.test_item_id = mti.id
          WHERE mti.package_id = ${input.sourceMockTestId}
        ) OR question_bank.source_mock_test_id = ${input.sourceMockTestId})`
      );
    }
    if (input.sourceTestItemId !== undefined) {
      // Filter by source_test_question_id matching test questions in the test item,
      // with fallback OR on source_test_item_id for backward compatibility with unmigrated entries
      query = query.where(
        sql`(question_bank.source_test_question_id IN (
          SELECT tq.id FROM test_questions tq
          JOIN test_item_subjects tis ON tq.subject_id = tis.id
          WHERE tis.test_item_id = ${input.sourceTestItemId}
        ) OR question_bank.source_test_item_id = ${input.sourceTestItemId})`
      );
    }
    if (input.directlyUploaded === true) {
      query = query.where("questionBank.sourceMockTestId", "is", null);
    }
    if (input.subjectName) {
      query = query.where("questionBank.subjectName", "=", input.subjectName);
    }
    if (input.questionType) {
      query = query.where("questionBank.questionType", "=", input.questionType as any);
    }
    if (input.tags) {
      const tagsArray = input.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagsArray.length > 0) {
        query = query.where(sql`${sql.ref('question_bank.tags')} && CAST(${tagsArray} AS text[])`);
      }
    }

    const [{ count }] = await query
      .select(db.fn.count<number>("questionBank.id").as("count"))
      .execute();
    const total = Number(count);

    const rows = await query
      .select([
        "questionBank.id",
        "questionBank.teacherId",
        "questionBank.examId",
        "questionBank.sourceMockTestId",
        "questionBank.questionText",
        "questionBank.questionType",
        "questionBank.optionA",
        "questionBank.optionB",
        "questionBank.optionC",
        "questionBank.optionD",
        "questionBank.correctOption",
        "questionBank.correctOptions",
        "questionBank.explanation",
        "questionBank.positiveMarks",
        "questionBank.negativeMarks",
        "questionBank.partialMarking",
        "questionBank.durationSeconds",
        "questionBank.subjectName",
        "questionBank.tags",
        "questionBank.numericalAnswer",
        "questionBank.numericalTolerance",
        "questionBank.paragraphText",
        "questionBank.matchData",
        "questionBank.sourceTestItemId",
        "questionBank.createdAt",
        "questionBank.updatedAt",
        "mockTests.title as sourceTestSeriesTitle",
        "mockTestItems.title as sourceTestItemTitle",
      ])
      .orderBy("questionBank.createdAt", "desc")
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute();

        let questions: QuestionBankWithMeta[] = rows.map((row) => ({
      ...row,
      sourceTestSeriesTitle: row.sourceTestSeriesTitle ?? null,
      sourceTestItemTitle: row.sourceTestItemTitle ?? null,
      alreadyImportedToSubject: false,
    }));

    // If checkSubjectId is provided, determine which questions are already imported
    if (input.checkSubjectId !== undefined && questions.length > 0) {
      const bankQuestionIds = questions
        .map((q) => q.id)
        .filter((id): id is number => id !== null && id !== undefined);

      if (bankQuestionIds.length > 0) {
        const importedRows = await db
          .selectFrom("testQuestions")
          .select("testQuestions.sourceBankQuestionId")
          .where("testQuestions.subjectId", "=", input.checkSubjectId)
          .where("testQuestions.sourceBankQuestionId", "in", bankQuestionIds)
          .execute();

        const importedSet = new Set(
          importedRows
            .map((r) => r.sourceBankQuestionId)
            .filter((id): id is number => id !== null && id !== undefined)
        );

        questions = questions.map((q) => ({
          ...q,
          alreadyImportedToSubject: importedSet.has(q.id) as boolean,
        }));
      }
    }

    // Fetch available subjects using content-based matching when filters are provided
    let subjectsQuery = db.selectFrom("questionBank")
      .select("questionBank.subjectName")
      .distinct()
      .where("questionBank.teacherId", "=", effectiveTeacherId)
      .where("questionBank.subjectName", "is not", null);

    if (input.sourceMockTestId !== undefined) {
      // Use the same source_test_question_id-based filtering for subjects
            subjectsQuery = subjectsQuery.where(
        sql`(question_bank.source_test_question_id IN (
          SELECT tq.id FROM test_questions tq
          JOIN test_item_subjects tis ON tq.subject_id = tis.id
          JOIN mock_test_items mti ON tis.test_item_id = mti.id
          WHERE mti.package_id = ${input.sourceMockTestId}
        ) OR question_bank.source_mock_test_id = ${input.sourceMockTestId})`
      );
    }
    if (input.sourceTestItemId !== undefined) {
      // Use the same source_test_question_id-based filtering for subjects
      subjectsQuery = subjectsQuery.where(
        sql`(question_bank.source_test_question_id IN (
          SELECT tq.id FROM test_questions tq
          JOIN test_item_subjects tis ON tq.subject_id = tis.id
          WHERE tis.test_item_id = ${input.sourceTestItemId}
        ) OR question_bank.source_test_item_id = ${input.sourceTestItemId})`
      );
    }
    if (input.directlyUploaded === true) {
      subjectsQuery = subjectsQuery.where("questionBank.sourceMockTestId", "is", null);
    }

    const subjectRows = await subjectsQuery.orderBy("questionBank.subjectName", "asc").execute();
    const availableSubjects = subjectRows.map(r => r.subjectName).filter(Boolean) as string[];

    return new Response(
      superjson.stringify({
        questions,
        availableSubjects,
        total,
        page: input.page,
        limit: input.limit,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error in question bank list endpoint:", error);
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