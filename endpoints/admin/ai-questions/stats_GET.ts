import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./stats_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const baseQuery = db.selectFrom("testQuestions").where("isAiGenerated", "=", true);

    // Total questions
    const totalQuestionsPromise = baseQuery
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    // Questions by exam
    const byExamPromise = db.selectFrom("testQuestions")
      .innerJoin("mockTestItems", "testQuestions.testId", "mockTestItems.id")
      .innerJoin("mockTests", "mockTestItems.packageId", "mockTests.id")
      .innerJoin("exams", "mockTests.examId", "exams.id")
      .where("testQuestions.isAiGenerated", "=", true)
      .select(["exams.examName", db.fn.countAll<string>().as("count")])
      .groupBy("exams.examName")
      .orderBy("count", "desc")
      .limit(10)
      .execute();

    // Custom prompts count
    const customPromptsPromise = baseQuery
      .where(sql`"ai_generation_metadata"->>'customPrompt'`, 'is not', null)
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    // Marked for review count
    const markedForReviewPromise = baseQuery
      .where("markedForReview", "=", true)
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    // Monthly stats
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthPromise = baseQuery
      .where("createdAt", ">=", startOfThisMonth)
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    const lastMonthPromise = baseQuery
      .where("createdAt", ">=", startOfLastMonth)
      .where("createdAt", "<=", endOfLastMonth)
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    const [
      totalResult,
      byExamResult,
      customPromptsResult,
      markedForReviewResult,
      thisMonthResult,
      lastMonthResult,
    ] = await Promise.all([
      totalQuestionsPromise,
      byExamPromise,
      customPromptsPromise,
      markedForReviewPromise,
      thisMonthPromise,
      lastMonthPromise,
    ]);

    const thisMonthCount = Number(thisMonthResult.count);
    const lastMonthCount = Number(lastMonthResult.count);
    let growthRate = 0;
    if (lastMonthCount > 0) {
      growthRate = ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;
    } else if (thisMonthCount > 0) {
      growthRate = 100; // Infinite growth, represent as 100%
    }

    const stats: OutputType = {
      totalQuestions: Number(totalResult.count),
      questionsByExam: byExamResult.map(r => ({ examName: r.examName, count: Number(r.count) })),
      customPromptsCount: Number(customPromptsResult.count),
      markedForReviewCount: Number(markedForReviewResult.count),
      thisMonthCount,
      lastMonthCount,
      monthlyGrowthRate: growthRate,
    };

    return new Response(superjson.stringify(stats));
  } catch (error) {
    console.error("[admin/ai-questions/stats_GET] Error fetching AI question stats:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}