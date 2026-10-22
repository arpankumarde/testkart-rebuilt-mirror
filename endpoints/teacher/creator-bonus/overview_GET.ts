import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import {
  campaignAmount,
  campaignRequirements,
  campaignSlotLimit,
  examSlotsTaken,
  getActiveCampaign,
  getRunningExamCampaigns,
  loadCourseVideoRows,
} from "../../../helpers/teacherCampaign";
import { loadContentExams, type ContentExam } from "../../../helpers/contentExams";
import {
  campaignProgress,
  evaluateCourseVideos,
  meetsCampaignCriteria,
  type CampaignContentType,
  type CampaignCriteria,
} from "../../../helpers/teacherCampaignRules";
import type { CampaignItem, CampaignItemState, ExamCampaignCard, OutputType } from "./overview_GET.schema";

type Row = {
  id: number;
  title: string;
  live: boolean;
  inReview: boolean;
  excluded: boolean;
  wasPublic: boolean;
  a: string;
  b: string;
};

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const campaign = await getActiveCampaign(db);
    if (!campaign) return new Response(superjson.stringify({ campaign: null } satisfies OutputType));
    const teacherId = effectiveTeacherId;

    const openReview = (type: CampaignContentType, idRef: string) => sql<boolean>`EXISTS (
      SELECT 1 FROM content_reviews cr WHERE cr.content_type = ${type} AND cr.content_id = ${sql.ref(idRef)}
        AND cr.status IN ('pending', 'senior_review'))`;
    const excluded = (type: CampaignContentType, idRef: string) => sql<boolean>`EXISTS (
      SELECT 1 FROM teacher_campaign_excluded_content x WHERE x.campaign_id = ${campaign.id}
        AND x.content_type = ${type} AND x.content_id = ${sql.ref(idRef)})`;

    const [tests, courses, claims] = await Promise.all([
      sql<Row>`
        SELECT mt.id, mt.title, (mt.is_published) AS live,
          ${openReview("mock_test", "mt.id")} AS in_review,
          ${excluded("mock_test", "mt.id")} AS excluded,
          (mt.is_published OR mt.was_ever_published OR EXISTS (
            SELECT 1 FROM content_reviews ar WHERE ar.content_type = 'mock_test' AND ar.content_id = mt.id
              AND ar.status = 'approved')) AS was_public,
          (SELECT COUNT(*) FROM mock_test_items i WHERE i.package_id = mt.id AND i.deleted_at IS NULL
            AND EXISTS (SELECT 1 FROM test_questions tq WHERE tq.test_id = i.id)) AS a,
          (SELECT COUNT(*) FROM test_questions tq JOIN mock_test_items i ON i.id = tq.test_id
            WHERE i.package_id = mt.id AND i.deleted_at IS NULL) AS b
        FROM mock_tests mt
        WHERE mt.teacher_id = ${teacherId} AND mt.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.mock_test_id = mt.id)
        ORDER BY mt.updated_at DESC NULLS LAST, mt.id DESC
      `.execute(db),
      sql<Row>`
        SELECT c.id, c.title, (c.status = 'published') AS live,
          ${openReview("course", "c.id")} AS in_review,
          ${excluded("course", "c.id")} AS excluded,
          TRUE AS was_public, 0 AS a, 0 AS b
        FROM courses c
        WHERE c.teacher_id = ${teacherId} AND c.status <> 'archived'
        ORDER BY c.updated_at DESC, c.id DESC
      `.execute(db),
      db
        .selectFrom("teacherCampaignClaims")
        .innerJoin("teacherCampaigns", "teacherCampaigns.id", "teacherCampaignClaims.campaignId")
        .leftJoin("contentReviews", "contentReviews.id", "teacherCampaignClaims.contentReviewId")
        .select([
          "teacherCampaignClaims.contentType",
          "teacherCampaignClaims.contentId",
          "teacherCampaignClaims.status",
          "teacherCampaignClaims.amount",
          "teacherCampaignClaims.campaignId",
          "teacherCampaignClaims.decisionNote",
          "teacherCampaignClaims.reverseReason",
          "teacherCampaigns.title as campaignTitle",
          "contentReviews.status as reviewStatus",
        ])
        .where("teacherCampaignClaims.teacherId", "=", teacherId)
        .orderBy("teacherCampaignClaims.id", "desc")
        .execute(),
    ]);

    const req = campaignRequirements(campaign);
    const courseVideos = await loadCourseVideoRows(db, courses.rows.map((c) => c.id));
    const slotCount = (type: CampaignContentType, statuses: string[]) =>
      claims.filter((c) => c.campaignId === campaign.id && c.contentType === type && statuses.includes(c.status)).length;
    const slots = {
      mock_test: {
        used: slotCount("mock_test", ["claimed", "credited"]),
        credited: slotCount("mock_test", ["credited"]),
        limit: campaignSlotLimit(campaign, "mock_test"),
        amount: campaignAmount(campaign, "mock_test"),
      },
      course: {
        used: slotCount("course", ["claimed", "credited"]),
        credited: slotCount("course", ["credited"]),
        limit: campaignSlotLimit(campaign, "course"),
        amount: campaignAmount(campaign, "course"),
      },
    };

    const running = await getRunningExamCampaigns(db);
    const examIds = running.flatMap((c) => (c.examId === null ? [] : [c.examId]));
    const newsIds = running.flatMap((c) => (c.examNewsPostId === null ? [] : [c.examNewsPostId]));
    const [takenByCampaign, testExams, examRows, newsRows] = await Promise.all([
      examSlotsTaken(db, running.map((c) => c.id)),
      running.length > 0
        ? loadContentExams(db, "mock_test", tests.rows.map((t) => t.id))
        : Promise.resolve(new Map<number, ContentExam[]>()),
      examIds.length > 0 ? db.selectFrom("exams").select(["id", "examName"]).where("id", "in", examIds).execute() : [],
      newsIds.length > 0
        ? db.selectFrom("examNewsPosts").select(["id", "title", "slug"]).where("id", "in", newsIds).where("status", "=", "published").execute()
        : [],
    ]);
    const examCampaigns: ExamCampaignCard[] = running.map((c) => {
      const news = newsRows.find((n) => n.id === c.examNewsPostId);
      return {
        id: c.id,
        title: c.title,
        examId: c.examId,
        examName: examRows.find((e) => e.id === c.examId)?.examName ?? c.title,
        amount: campaignAmount(c, "mock_test"),
        totalSlots: c.totalSlots ?? 0,
        slotsTaken: takenByCampaign.get(c.id) ?? 0,
        perTeacher: campaignSlotLimit(c, "mock_test"),
        mine: claims.filter((claim) => claim.campaignId === c.id && ["claimed", "credited"].includes(claim.status)).length,
        minTests: c.minTests,
        minQuestions: c.minQuestions,
        endsAt: c.endsAt!,
        news: news ? { title: news.title, slug: news.slug } : null,
      };
    });
    const openExamBonus = (mockTestId: number) => {
      const exams = testExams.get(mockTestId) ?? [];
      return examCampaigns.find(
        (card) => card.slotsTaken < card.totalSlots && card.mine < card.perTeacher && exams.some((e) => e.examId === card.examId)
      );
    };

    const toItems = (type: CampaignContentType, rows: Row[]): CampaignItem[] =>
      rows.map((row) => {
        const criteria: CampaignCriteria =
          type === "mock_test"
            ? { kind: "mock_test", tests: Number(row.a), questions: Number(row.b) }
            : evaluateCourseVideos(courseVideos.get(row.id) ?? [], req.minMinutesPerVideo);
        const mine = claims.filter((c) => c.contentType === type && c.contentId === row.id);
        const active = mine.find((c) => c.status === "claimed" || c.status === "credited" || c.status === "reversed");
        const declined = mine.filter((c) => c.status === "declined");
        const exam = !active && !row.wasPublic ? openExamBonus(row.id) : undefined;
        let state: CampaignItemState;
        if (active) state = active.status as CampaignItemState;
        else if (declined.length >= campaign.maxDeclinesPerItem) state = "final";
        else if (row.excluded) state = "excluded";
        else if (!meetsCampaignCriteria(criteria, req)) state = "building";
        else if (slots[type].used >= slots[type].limit) state = exam ? "ready" : "full";
        else state = "ready";
        const noteSource = active?.status === "reversed" ? active.reverseReason : declined[0]?.decisionNote;
        return {
          type,
          id: row.id,
          title: row.title,
          live: Boolean(row.live),
          inReview: Boolean(row.inReview),
          state,
          progress: campaignProgress(criteria, req),
          approved: active?.status === "claimed" && active.reviewStatus === "approved",
          note: noteSource ?? null,
          declines: declined.length,
          uncountedVideos: criteria.kind === "course" ? criteria.lessons.filter((l) => !l.counted).length : 0,
          examBonus: exam ? { title: exam.title, amount: exam.amount } : null,
          claimedExamBonus: active && active.campaignId !== campaign.id ? active.campaignTitle : null,
        };
      });

    const creditedTotal = (matches: (campaignId: number) => boolean) =>
      claims
        .filter((c) => c.status === "credited" && matches(c.campaignId))
        .reduce((sum, c) => sum + Number(c.amount), 0);

    const output: OutputType = {
      campaign: {
        title: campaign.title,
        startsAt: campaign.startsAt,
        requirements: req,
        maxDeclinesPerItem: campaign.maxDeclinesPerItem,
      },
      slots,
      earned: creditedTotal((id) => id === campaign.id),
      examEarned: creditedTotal((id) => id !== campaign.id),
      examCampaigns,
      items: [...toItems("mock_test", tests.rows), ...toItems("course", courses.rows)],
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("[creator-bonus/overview]", error);
    return new Response(superjson.stringify({ error: "Could not load the Creator Bonus. Try again." }), { status: 500 });
  }
}