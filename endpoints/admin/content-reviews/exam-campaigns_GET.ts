import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import type { ExamCampaignAdminView, ExamCampaignSuggestion, OutputType } from "./exam-campaigns_GET.schema";

const NEWS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAST_LIMIT = 40;

async function loadSuggestions(now: Date): Promise<ExamCampaignSuggestion[]> {
  const since = new Date(now.getTime() - NEWS_WINDOW_MS);
  const { rows } = await sql<{
    postId: number;
    title: string;
    newsType: string;
    publishedAt: Date;
    examId: number;
    examName: string;
    taggedSeries: string;
  }>`
    SELECT DISTINCT ON (p.exam_id)
      p.id AS post_id, p.title, p.news_type, p.published_at, p.exam_id, e.exam_name,
      (SELECT COUNT(*) FROM mock_tests mt
        WHERE mt.deleted_at IS NULL AND (mt.exam_id = p.exam_id OR EXISTS (
          SELECT 1 FROM mock_test_exams mte WHERE mte.mock_test_id = mt.id AND mte.exam_id = p.exam_id
        ))) AS tagged_series
    FROM exam_news_posts p
    JOIN exams e ON e.id = p.exam_id
    WHERE p.status = 'published' AND p.published_at >= ${since}
      AND NOT EXISTS (
        SELECT 1 FROM teacher_campaigns c
        WHERE c.kind = 'exam' AND c.exam_id = p.exam_id AND c.is_active AND c.ends_at > ${now}
      )
    ORDER BY p.exam_id, p.published_at DESC
  `.execute(db);
  return rows
    .map((row) => ({ ...row, taggedSeries: Number(row.taggedSeries) }))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

async function loadCampaigns(now: Date): Promise<ExamCampaignAdminView[]> {
  const rows = await db
    .selectFrom("teacherCampaigns as c")
    .leftJoin("exams as e", "e.id", "c.examId")
    .leftJoin("examNewsPosts as p", "p.id", "c.examNewsPostId")
    .selectAll("c")
    .select(["e.examName as examName", "p.title as newsTitle"])
    .where("c.kind", "=", "exam")
    .orderBy("c.id", "desc")
    .limit(PAST_LIMIT)
    .execute();
  if (rows.length === 0) return [];

  const totals = await db
    .selectFrom("teacherCampaignClaims")
    .select([
      "campaignId",
      "status",
      (eb) => eb.fn.countAll<string>().as("count"),
      sql<string>`COALESCE(SUM(amount), 0)`.as("total"),
    ])
    .where("campaignId", "in", rows.map((r) => r.id))
    .groupBy(["campaignId", "status"])
    .execute();
  const statOf = (campaignId: number, status: string) =>
    totals.find((t) => t.campaignId === campaignId && t.status === status);
  const countOf = (campaignId: number, status: string) => Number(statOf(campaignId, status)?.count ?? 0);

  return rows.map((row) => {
    const endsAt = row.endsAt ?? row.startsAt;
    const waiting = countOf(row.id, "claimed");
    const credited = countOf(row.id, "credited");
    return {
      id: row.id,
      title: row.title,
      examName: row.examName,
      newsTitle: row.newsTitle,
      amount: Number(row.mockTestAmount),
      totalSlots: row.totalSlots ?? 0,
      perTeacher: row.maxMockTests,
      minTests: row.minTests,
      minQuestions: row.minQuestions,
      startsAt: row.startsAt,
      endsAt,
      running: row.isActive && endsAt > now,
      taken: waiting + credited + countOf(row.id, "reversed"),
      waiting,
      credited,
      creditedAmount: Number(statOf(row.id, "credited")?.total ?? 0),
    };
  });
}

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const now = new Date();
    const [suggestions, campaigns] = await Promise.all([loadSuggestions(now), loadCampaigns(now)]);
    const output: OutputType = {
      suggestions,
      running: campaigns.filter((c) => c.running),
      past: campaigns.filter((c) => !c.running),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing Exam Bonus campaigns:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}