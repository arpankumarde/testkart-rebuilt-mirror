import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const url = new URL(request.url);
    const params = url.searchParams;

    const parsedInput = schema.parse({
      page: params.get("page") ? parseInt(params.get("page") as string, 10) : 1,
      pageSize: params.get("pageSize") ? parseInt(params.get("pageSize") as string, 10) : 20,
      examId: params.get("examId") ? parseInt(params.get("examId") as string, 10) : undefined,
      teacherId: params.get("teacherId") ? parseInt(params.get("teacherId") as string, 10) : undefined,
      hasCustomPrompt: params.get("hasCustomPrompt") === 'true' ? true : params.get("hasCustomPrompt") === 'false' ? false : undefined,
      dateFrom: params.get("dateFrom") ? new Date(params.get("dateFrom") as string) : undefined,
      dateTo: params.get("dateTo") ? new Date(params.get("dateTo") as string) : undefined,
      markedForReview: params.get("markedForReview") === 'true' ? true : params.get("markedForReview") === 'false' ? false : undefined,
      searchQuery: params.get("searchQuery") || undefined,
    });

    const { page, pageSize, ...filters } = parsedInput;
    const offset = (page - 1) * pageSize;

    let query = db
      .selectFrom("testQuestions")
      .innerJoin("mockTestItems", "testQuestions.testId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .innerJoin("users", "mockTests.teacherId", "users.id")
      .innerJoin("exams", "mockTests.examId", "exams.id")
      .leftJoin("testItemSubjects", "testQuestions.subjectId", "testItemSubjects.id")
      .where("testQuestions.isAiGenerated", "=", true);

    if (filters.examId) {
      query = query.where("mockTests.examId", "=", filters.examId);
    }
    if (filters.teacherId) {
      query = query.where("mockTests.teacherId", "=", filters.teacherId);
    }
    if (filters.hasCustomPrompt === true) {
      query = query.where(sql`"testQuestions"."ai_generation_metadata"->>'customPrompt'`, 'is not', null);
    }
    if (filters.hasCustomPrompt === false) {
      query = query.where(sql`"testQuestions"."ai_generation_metadata"->>'customPrompt'`, 'is', null);
    }
    if (filters.dateFrom) {
      query = query.where("testQuestions.createdAt", ">=", filters.dateFrom);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setDate(toDate.getDate() + 1); // Include the whole day
      query = query.where("testQuestions.createdAt", "<", toDate);
    }
    if (filters.markedForReview !== undefined) {
      query = query.where("testQuestions.markedForReview", "=", filters.markedForReview);
    }
    if (filters.searchQuery) {
      query = query.where("testQuestions.questionText", "ilike", `%${filters.searchQuery}%`);
    }

    const questionsQuery = query
      .selectAll("testQuestions")
      .select([
        "testItemSubjects.subjectName",
        "testItemSubjects.id as subjectId",
        "mockTestItems.title as testItemTitle",
        "mockTestItems.id as testItemId",
        "mockTests.title as testPackageName",
        "exams.examName",
        "users.id as teacherId",
        "users.displayName as teacherName",
        "users.academyName",
      ])
      .orderBy("testQuestions.createdAt", "desc")
      .limit(pageSize)
      .offset(offset);

    const countQuery = query.select(db.fn.countAll().as("total"));

    const [questions, countResult] = await Promise.all([
      questionsQuery.execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    const total = Number(countResult.total);
    const totalPages = Math.ceil(total / pageSize);

    return new Response(
      superjson.stringify({
        questions,
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
        },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/ai-questions/list_GET] Error fetching AI questions:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}