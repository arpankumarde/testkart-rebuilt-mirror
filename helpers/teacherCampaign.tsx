import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import type { DB, TeacherCampaignClaims, TeacherCampaigns } from "./schema";
import { lockWallet } from "./walletLock";
import {
  CAMPAIGN_CONTENT_NOUNS,
  evaluateCourseVideos,
  meetsCampaignCriteria,
  missingCriteriaText,
  type CampaignContentType,
  type CampaignCriteria,
  type CampaignRequirements,
  type CourseVideoRow,
} from "./teacherCampaignRules";

/*
 * Server side of teacher campaigns (rules in helpers/teacherCampaignRules).
 *
 * - Only content that was never live before the campaign started can claim. The
 *   items that were live at launch are listed in teacher_campaign_excluded_content.
 * - One claim per item: a unique index allows a single claimed, credited or
 *   reversed row per item. A declined claim frees the item until it has been
 *   declined maxDeclinesPerItem times.
 * - A claim is tied to the review it was submitted with. When that review is
 *   withdrawn, deleted or rejected the claim is withdrawn, so the teacher can
 *   claim again with the next submission.
 * - Crediting needs the review approved, the item live and still meeting the
 *   rules, and a free slot (max per type, counting claimed and credited rows).
 *   Claims and credits take the teacher's wallet lock so parallel requests
 *   cannot pass the cap together.
 * - Course videos count only as uploads, once per file, and at least
 *   minMinutesPerVideo long (evaluateCourseVideos).
 */

type Executor = Kysely<DB> | Transaction<DB>;
export type Campaign = Selectable<TeacherCampaigns>;
export type CampaignClaim = Selectable<TeacherCampaignClaims>;

const SLOT_STATUSES = ["claimed", "credited"] as const;

export const campaignRequirements = (c: Campaign): CampaignRequirements => ({
  minTests: c.minTests,
  minQuestions: c.minQuestions,
  minVideos: c.minVideos,
  minVideoMinutes: c.minVideoMinutes,
  minMinutesPerVideo: c.minMinutesPerVideo,
});

export const campaignAmount = (c: Campaign, type: CampaignContentType): number =>
  Number(type === "mock_test" ? c.mockTestAmount : c.courseAmount);

export const campaignSlotLimit = (c: Campaign, type: CampaignContentType): number =>
  type === "mock_test" ? c.maxMockTests : c.maxCourses;

export const isCampaignContentType = (type: string): type is CampaignContentType =>
  type === "mock_test" || type === "course";

export async function getActiveCampaign(executor: Executor, now = new Date()): Promise<Campaign | null> {
  const row = await executor
    .selectFrom("teacherCampaigns")
    .selectAll()
    .where("isActive", "=", true)
    .where("startsAt", "<=", now)
    .where((eb) => eb.or([eb("endsAt", "is", null), eb("endsAt", ">", now)]))
    .orderBy("id", "desc")
    .executeTakeFirst();
  return row ?? null;
}

/** Tests that have at least one question, and the questions across untrashed tests. */
export async function measureMockTest(executor: Executor, mockTestId: number): Promise<CampaignCriteria> {
  const { rows } = await sql<{ tests: string; questions: string }>`
    SELECT COUNT(*) FILTER (WHERE q.cnt > 0) AS tests, COALESCE(SUM(q.cnt), 0) AS questions
    FROM (
      SELECT (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = i.id) AS cnt
      FROM mock_test_items i
      WHERE i.package_id = ${mockTestId} AND i.deleted_at IS NULL
    ) q
  `.execute(executor);
  return { kind: "mock_test", tests: Number(rows[0]?.tests ?? 0), questions: Number(rows[0]?.questions ?? 0) };
}

/**
 * Video lessons of the given courses in course order, with the typed duration and
 * the length the asset library recorded for the same file, when it has one.
 */
export async function loadCourseVideoRows(
  executor: Executor,
  courseIds: number[]
): Promise<Map<number, CourseVideoRow[]>> {
  const result = new Map<number, CourseVideoRow[]>();
  if (courseIds.length === 0) return result;
  const { rows } = await sql<{
    courseId: number;
    title: string;
    contentUrl: string | null;
    durationMinutes: number | null;
    recordedSeconds: number | null;
  }>`
    SELECT s.course_id, l.title, l.content_url, l.duration_minutes,
      (SELECT ta.duration_seconds FROM teacher_assets ta
        WHERE ta.url = l.content_url AND ta.duration_seconds IS NOT NULL LIMIT 1) AS recorded_seconds
    FROM course_lessons l
    JOIN course_sections s ON s.id = l.section_id
    WHERE s.course_id IN (${sql.join(courseIds)}) AND l.content_type = 'video'
    ORDER BY s.course_id, s.order_index, l.order_index, l.id
  `.execute(executor);
  for (const row of rows) {
    const list = result.get(row.courseId) ?? [];
    list.push({
      title: row.title,
      url: row.contentUrl,
      typedMinutes: row.durationMinutes,
      recordedSeconds: row.recordedSeconds === null ? null : Number(row.recordedSeconds),
    });
    result.set(row.courseId, list);
  }
  return result;
}

export async function measureCourse(executor: Executor, courseId: number, req: CampaignRequirements): Promise<CampaignCriteria> {
  const rows = (await loadCourseVideoRows(executor, [courseId])).get(courseId) ?? [];
  return evaluateCourseVideos(rows, req.minMinutesPerVideo);
}

export const measureContent = (executor: Executor, type: CampaignContentType, id: number, req: CampaignRequirements) =>
  type === "mock_test" ? measureMockTest(executor, id) : measureCourse(executor, id, req);

export type CampaignContent = { teacherId: number; title: string; live: boolean; usable: boolean };

/** Owner, title, whether it is live, and whether it can take part at all (not trashed, not a live test). */
export async function loadCampaignContent(
  executor: Executor,
  type: CampaignContentType,
  id: number
): Promise<CampaignContent | null> {
  if (type === "mock_test") {
    const row = await executor
      .selectFrom("mockTests")
      .select((eb) => [
        "teacherId",
        "title",
        "isPublished",
        "deletedAt",
        eb
          .exists(eb.selectFrom("liveTests").select("liveTests.id").whereRef("liveTests.mockTestId", "=", "mockTests.id"))
          .as("isLiveTest"),
      ])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return {
      teacherId: row.teacherId,
      title: row.title,
      live: row.isPublished && !row.deletedAt,
      usable: !row.deletedAt && !row.isLiveTest,
    };
  }
  const row = await executor
    .selectFrom("courses")
    .select(["teacherId", "title", "status"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return null;
  return { teacherId: row.teacherId, title: row.title, live: row.status === "published", usable: row.status !== "archived" };
}

export async function isExcludedFromCampaign(
  executor: Executor,
  campaignId: number,
  type: CampaignContentType,
  id: number
): Promise<boolean> {
  const row = await executor
    .selectFrom("teacherCampaignExcludedContent")
    .select("contentId")
    .where("campaignId", "=", campaignId)
    .where("contentType", "=", type)
    .where("contentId", "=", id)
    .executeTakeFirst();
  return Boolean(row);
}

export async function slotsUsed(
  executor: Executor,
  campaignId: number,
  teacherId: number,
  type: CampaignContentType,
  statuses: readonly ("claimed" | "credited")[] = SLOT_STATUSES
): Promise<number> {
  const row = await executor
    .selectFrom("teacherCampaignClaims")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("campaignId", "=", campaignId)
    .where("teacherId", "=", teacherId)
    .where("contentType", "=", type)
    .where("status", "in", [...statuses])
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export type ClaimCheck =
  | { ok: true; criteria: CampaignCriteria; amount: number }
  | { ok: false; reason: string; criteria: CampaignCriteria | null };

/** Whether teacherId can claim the bonus for this item right now, and why not. */
export async function checkClaimable(
  executor: Executor,
  campaign: Campaign,
  teacherId: number,
  type: CampaignContentType,
  id: number
): Promise<ClaimCheck> {
  const noun = CAMPAIGN_CONTENT_NOUNS[type];
  const content = await loadCampaignContent(executor, type, id);
  if (!content || content.teacherId !== teacherId) {
    return { ok: false, reason: `This ${noun} was not found in your account.`, criteria: null };
  }
  if (!content.usable) {
    return { ok: false, reason: `This ${noun} cannot take part in the ${campaign.title}.`, criteria: null };
  }
  if (await isExcludedFromCampaign(executor, campaign.id, type, id)) {
    return {
      ok: false,
      reason: `This ${noun} was already live before the ${campaign.title} started, so it cannot claim it.`,
      criteria: null,
    };
  }

  const claims = await executor
    .selectFrom("teacherCampaignClaims")
    .select(["status"])
    .where("contentType", "=", type)
    .where("contentId", "=", id)
    .execute();
  if (claims.some((c) => c.status === "claimed")) {
    return { ok: false, reason: `The bonus for this ${noun} is already claimed.`, criteria: null };
  }
  if (claims.some((c) => c.status === "credited" || c.status === "reversed")) {
    return { ok: false, reason: `This ${noun} has already had its bonus. It can be claimed once per item.`, criteria: null };
  }
  if (claims.filter((c) => c.status === "declined").length >= campaign.maxDeclinesPerItem) {
    return { ok: false, reason: `This ${noun} was not selected for the bonus, so it cannot claim again.`, criteria: null };
  }

  const req = campaignRequirements(campaign);
  const criteria = await measureContent(executor, type, id, req);
  if (!meetsCampaignCriteria(criteria, req)) {
    return { ok: false, reason: `Add ${missingCriteriaText(criteria, req)} to claim the bonus.`, criteria };
  }

  const limit = campaignSlotLimit(campaign, type);
  if ((await slotsUsed(executor, campaign.id, teacherId, type)) >= limit) {
    return {
      ok: false,
      reason: `You have used all ${limit} ${noun} bonuses in the ${campaign.title}.`,
      criteria,
    };
  }

  return { ok: true, criteria, amount: campaignAmount(campaign, type) };
}

/** Claims the bonus alongside a review submission. Throws a teacher-readable Error when it cannot. */
export async function createClaim(
  trx: Transaction<DB>,
  input: { teacherId: number; type: CampaignContentType; contentId: number; reviewId: number }
): Promise<{ amount: number; campaignTitle: string }> {
  const campaign = await getActiveCampaign(trx);
  if (!campaign) throw new Error("The Creator Bonus is not running right now. Submit without claiming it.");
  await lockWallet(trx, input.teacherId);
  const check = await checkClaimable(trx, campaign, input.teacherId, input.type, input.contentId);
  if (!check.ok) throw new Error(check.reason);
  await trx
    .insertInto("teacherCampaignClaims")
    .values({
      campaignId: campaign.id,
      teacherId: input.teacherId,
      contentType: input.type,
      contentId: input.contentId,
      contentReviewId: input.reviewId,
      amount: check.amount.toFixed(2),
      criteriaAtClaim: check.criteria,
    })
    .execute();
  return { amount: check.amount, campaignTitle: campaign.title };
}

/** Withdraws claims still waiting on these reviews (the review was withdrawn, deleted or rejected). */
export async function withdrawClaimsForReviews(executor: Executor, reviewIds: number[], note: string): Promise<number> {
  if (reviewIds.length === 0) return 0;
  const result = await executor
    .updateTable("teacherCampaignClaims")
    .set({ status: "withdrawn", decisionNote: note, updatedAt: new Date() })
    .where("contentReviewId", "in", reviewIds)
    .where("status", "=", "claimed")
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

async function lockClaim(trx: Transaction<DB>, claimId: number): Promise<CampaignClaim> {
  const claim = await trx
    .selectFrom("teacherCampaignClaims")
    .selectAll()
    .where("id", "=", claimId)
    .forUpdate()
    .executeTakeFirst();
  if (!claim) throw new Error("This bonus claim no longer exists.");
  return claim;
}

/**
 * Credits a claimed bonus to the teacher's balance. Re-checks everything the
 * claim was accepted on, because the teacher can edit or unpublish in between.
 */
export async function creditClaim(
  trx: Transaction<DB>,
  claimId: number,
  adminId: number,
  now = new Date()
): Promise<CampaignClaim> {
  const claim = await lockClaim(trx, claimId);
  if (claim.status !== "claimed") throw new Error(`This bonus is already ${claim.status}.`);
  if (!isCampaignContentType(claim.contentType)) throw new Error("This claim is not for a test series or course.");
  const type = claim.contentType;
  const noun = CAMPAIGN_CONTENT_NOUNS[type];

  await lockWallet(trx, claim.teacherId);

  const review = claim.contentReviewId
    ? await trx.selectFrom("contentReviews").select("status").where("id", "=", claim.contentReviewId).executeTakeFirst()
    : undefined;
  if (review?.status !== "approved") throw new Error(`Approve the ${noun} before crediting its bonus.`);

  const content = await loadCampaignContent(trx, type, claim.contentId);
  if (!content || !content.live) throw new Error(`This ${noun} is not live any more, so the bonus cannot be credited.`);

  const campaign = await trx
    .selectFrom("teacherCampaigns")
    .selectAll()
    .where("id", "=", claim.campaignId)
    .executeTakeFirstOrThrow();
  const req = campaignRequirements(campaign);
  const criteria = await measureContent(trx, type, claim.contentId, req);
  if (!meetsCampaignCriteria(criteria, req)) {
    throw new Error(`This ${noun} no longer meets the rules: it needs ${missingCriteriaText(criteria, req)}.`);
  }
  const limit = campaignSlotLimit(campaign, type);
  if ((await slotsUsed(trx, campaign.id, claim.teacherId, type, ["credited"])) >= limit) {
    throw new Error(`This teacher already has ${limit} ${noun} bonuses credited.`);
  }

  return trx
    .updateTable("teacherCampaignClaims")
    .set({
      status: "credited",
      criteriaAtCredit: criteria,
      decidedBy: adminId,
      decidedAt: now,
      creditedAt: now,
      updatedAt: now,
    })
    .where("id", "=", claimId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function declineClaim(
  trx: Transaction<DB>,
  claimId: number,
  adminId: number,
  note: string,
  now = new Date()
): Promise<CampaignClaim> {
  const claim = await lockClaim(trx, claimId);
  if (claim.status !== "claimed") throw new Error(`This bonus is already ${claim.status}.`);
  return trx
    .updateTable("teacherCampaignClaims")
    .set({ status: "declined", decisionNote: note, decidedBy: adminId, decidedAt: now, updatedAt: now })
    .where("id", "=", claimId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Takes a credited bonus back off the balance. The item cannot claim again. */
export async function reverseClaim(
  trx: Transaction<DB>,
  claimId: number,
  adminId: number,
  reason: string,
  now = new Date()
): Promise<CampaignClaim> {
  const claim = await lockClaim(trx, claimId);
  if (claim.status !== "credited") throw new Error("Only a credited bonus can be reversed.");
  await lockWallet(trx, claim.teacherId);
  return trx
    .updateTable("teacherCampaignClaims")
    .set({ status: "reversed", reversedAt: now, reversedBy: adminId, reverseReason: reason, updatedAt: now })
    .where("id", "=", claimId)
    .returningAll()
    .executeTakeFirstOrThrow();
}