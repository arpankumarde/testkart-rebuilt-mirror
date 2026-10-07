import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import {
  campaignAmount,
  campaignRequirements,
  campaignSlotLimit,
  getActiveCampaign,
  loadCourseVideoRows,
} from "../../../helpers/teacherCampaign";
import {
  campaignProgress,
  evaluateCourseVideos,
  meetsCampaignCriteria,
  type CampaignContentType,
  type CampaignCriteria,
} from "../../../helpers/teacherCampaignRules";
import type { CampaignItem, CampaignItemState, OutputType } from "./overview_GET.schema";

type Row = {
  id: number;
  title: string;
  live: boolean;
  inReview: boolean;
  excluded: boolean;
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
          0 AS a, 0 AS b
        FROM courses c
        WHERE c.teacher_id = ${teacherId} AND c.status <> 'archived'
        ORDER BY c.updated_at DESC, c.id DESC
      `.execute(db),
      db
        .selectFrom("teacherCampaignClaims")
        .leftJoin("contentReviews", "contentReviews.id", "teacherCampaignClaims.contentReviewId")
        .select([
          "teacherCampaignClaims.contentType",
          "teacherCampaignClaims.contentId",
          "teacherCampaignClaims.status",
          "teacherCampaignClaims.amount",
          "teacherCampaignClaims.campaignId",
          "teacherCampaignClaims.decisionNote",
          "teacherCampaignClaims.reverseReason",
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

    const toItems = (type: CampaignContentType, rows: Row[]): CampaignItem[] =>
      rows.map((row) => {
        const criteria: CampaignCriteria =
          type === "mock_test"
            ? { kind: "mock_test", tests: Number(row.a), questions: Number(row.b) }
            : evaluateCourseVideos(courseVideos.get(row.id) ?? [], req.minMinutesPerVideo);
        const mine = claims.filter((c) => c.contentType === type && c.contentId === row.id);
        const active = mine.find((c) => c.status === "claimed" || c.status === "credited" || c.status === "reversed");
        const declined = mine.filter((c) => c.status === "declined");
        let state: CampaignItemState;
        if (active) state = active.status as CampaignItemState;
        else if (declined.length >= campaign.maxDeclinesPerItem) state = "final";
        else if (row.excluded) state = "excluded";
        else if (!meetsCampaignCriteria(criteria, req)) state = "building";
        else if (slots[type].used >= slots[type].limit) state = "full";
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
        };
      });

    const earned = claims
      .filter((c) => c.status === "credited")
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const output: OutputType = {
      campaign: {
        title: campaign.title,
        startsAt: campaign.startsAt,
        requirements: req,
        maxDeclinesPerItem: campaign.maxDeclinesPerItem,
      },
      slots,
      earned,
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