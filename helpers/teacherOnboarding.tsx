import { sql } from "kysely";
import { db } from "./db";
import { sendEmail } from "./sendEmail";
import { teacherProfileCompleteness } from "./teacherProfileCompleteness";
import { unsubscribeHeaders, unsubscribePageUrl } from "./emailUnsubscribe";
import { renderTeacherOnboardingEmail, type OnboardingPlanRow } from "./teacherOnboardingContent";
import {
  ONBOARDING_EMAIL_KEYS,
  ONBOARDING_TIMING,
  planOnboarding,
  type OnboardingEmailKey,
  type OnboardingPlan,
  type OnboardingSendRecord,
  type OnboardingSendStatus,
} from "./teacherOnboardingSchedule";

/**
 * Scheduled job (every 15 minutes) for the teacher onboarding emails. Rules and
 * timing: helpers/teacherOnboardingSchedule. Copy: helpers/teacherOnboardingContent.
 *
 * Each run enrols teachers who signed up in the last 13 days, records the first
 * publish it sees, writes a row for every email it skips, then sends at most one
 * email per teacher. A send is claimed in teacher_onboarding_emails before it
 * goes out, so an email is never sent twice; a failed one is retried up to 3
 * times while it is still in date.
 *
 * Out of scope: team managers, inactive accounts, anyone without an email and
 * anyone who unsubscribed from the list.
 */

const LIST = "teacher_onboarding" as const;
const ENROL_WITHIN_DAYS = 13;
const ACTIVE_FOR_DAYS = 16;
const MAX_SENDS_PER_RUN = 40;
const SEND_SPACING_MS = 600;
const FROM_NAME = "Team Testkart";
const REPLY_TO = "support@testkart.in";
const DAY_MS = 24 * 60 * 60 * 1000;

type CandidateRow = {
  teacherId: number;
  email: string;
  signedUpAt: Date;
  enrolledAt: Date | null;
  firstPublishedAt: Date | null;
  publishEvidenceAt: Date | null;
  hasListing: boolean | null;
  hasBankDetails: boolean;
  avatarUrl: string | null;
  displayName: string | null;
  slug: string | null;
  tagline: string | null;
  bio: string | null;
  location: string | null;
  languages: unknown;
  expertiseAreas: unknown;
  websiteUrl: string | null;
  socialLinks: unknown;
  awardsCertificates: unknown;
};

export type TeacherOnboardingPlanEntry = {
  teacherId: number;
  newlyEnrolled: boolean;
  newlyPublishedAt: Date | null;
  plan: OnboardingPlan;
};

export type TeacherOnboardingRunSummary = {
  enrolled: number;
  publishesRecorded: number;
  skipped: number;
  sent: number;
  failed: number;
  plans?: TeacherOnboardingPlanEntry[];
};

const eligibleTeacher = (now: Date, withinDays: number) => sql<boolean>`
  u.role = 'teacher'
  AND u.is_active
  AND u.email LIKE '%@%'
  AND u.created_at >= ${new Date(now.getTime() - withinDays * DAY_MS)}
  AND NOT EXISTS (
    SELECT 1 FROM teacher_team_members m WHERE m.member_user_id = u.id AND m.status = 'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM email_unsubscribes x WHERE x.user_id = u.id AND x.list = ${LIST}
  )`;

async function enrolTeachers(now: Date): Promise<number> {
  const result = await sql`
    INSERT INTO teacher_onboarding (teacher_id, enrolled_at)
    SELECT u.id, ${now}::timestamptz FROM users u
    WHERE ${eligibleTeacher(now, ENROL_WITHIN_DAYS)}
    ON CONFLICT (teacher_id) DO NOTHING
    RETURNING teacher_id`.execute(db);
  return result.rows.length;
}

async function loadCandidates(now: Date, includeUnenrolled: boolean): Promise<CandidateRow[]> {
  const enrolWindow = new Date(now.getTime() - ENROL_WITHIN_DAYS * DAY_MS);
  const result = await sql<CandidateRow>`
    SELECT
      u.id AS "teacherId",
      u.email AS "email",
      u.created_at AS "signedUpAt",
      o.enrolled_at AS "enrolledAt",
      o.first_published_at AS "firstPublishedAt",
      CASE WHEN o.first_published_at IS NULL THEN LEAST(
        (SELECT MIN(r.created_at) FROM content_reviews r WHERE r.teacher_id = u.id),
        (SELECT MIN(c.published_at) FROM courses c WHERE c.teacher_id = u.id AND c.published_at IS NOT NULL),
        (SELECT MIN(d.published_at AT TIME ZONE 'UTC') FROM digital_products d WHERE d.teacher_id = u.id AND d.published_at IS NOT NULL),
        (SELECT MIN(b.published_at AT TIME ZONE 'UTC') FROM course_bundles b WHERE b.teacher_id = u.id AND b.published_at IS NOT NULL),
        (SELECT MIN(t.created_at AT TIME ZONE 'UTC') FROM mock_tests t WHERE t.teacher_id = u.id AND (t.is_published OR t.was_ever_published)),
        (SELECT MIN(l.created_at) FROM live_tests l WHERE l.teacher_id = u.id AND l.is_active)
      ) END AS "publishEvidenceAt",
      CASE WHEN o.first_published_at IS NULL THEN (
        EXISTS (SELECT 1 FROM digital_products d WHERE d.teacher_id = u.id AND (d.is_published OR d.status = 'published'))
        OR EXISTS (SELECT 1 FROM courses c WHERE c.teacher_id = u.id AND c.status = 'published')
        OR EXISTS (SELECT 1 FROM course_bundles b WHERE b.teacher_id = u.id AND b.is_published)
      ) END AS "hasListing",
      EXISTS (
        SELECT 1 FROM teacher_bank_details k
        WHERE k.teacher_id = u.id AND k.verification_status IN ('pending', 'verified')
      ) AS "hasBankDetails",
      u.avatar_url AS "avatarUrl",
      u.display_name AS "displayName",
      u.slug AS "slug",
      u.tagline AS "tagline",
      u.bio AS "bio",
      u.location AS "location",
      u.languages AS "languages",
      u.expertise_areas AS "expertiseAreas",
      u.website_url AS "websiteUrl",
      u.social_links AS "socialLinks",
      u.awards_certificates AS "awardsCertificates"
    FROM users u
    LEFT JOIN teacher_onboarding o ON o.teacher_id = u.id
    WHERE ${eligibleTeacher(now, ACTIVE_FOR_DAYS)}
      AND (o.teacher_id IS NOT NULL OR (${includeUnenrolled}::boolean AND u.created_at >= ${enrolWindow}))
      AND (
        SELECT COUNT(*) FROM teacher_onboarding_emails e
        WHERE e.teacher_id = u.id AND (e.status <> 'failed' OR e.attempts >= ${ONBOARDING_TIMING.maxAttempts})
      ) < ${ONBOARDING_EMAIL_KEYS.length}`.execute(db);
  return result.rows;
}

async function loadSends(teacherIds: number[]): Promise<Map<number, OnboardingSendRecord[]>> {
  const byTeacher = new Map<number, OnboardingSendRecord[]>();
  if (teacherIds.length === 0) return byTeacher;
  const rows = await db
    .selectFrom("teacherOnboardingEmails")
    .select(["teacherId", "emailKey", "status", "attempts", "updatedAt"])
    .where("teacherId", "in", teacherIds)
    .execute();
  for (const row of rows) {
    const list = byTeacher.get(row.teacherId) ?? [];
    list.push({
      emailKey: row.emailKey,
      status: row.status as OnboardingSendStatus,
      attempts: row.attempts,
      updatedAt: row.updatedAt,
    });
    byTeacher.set(row.teacherId, list);
  }
  return byTeacher;
}

async function loadPlans(): Promise<OnboardingPlanRow[]> {
  const rows = await db
    .selectFrom("subscriptionPlans")
    .select(["name", "price", "platformFeePercentage"])
    .where("isActive", "=", true)
    .where("billingCycle", "in", ["none", "monthly"])
    .orderBy("price", "asc")
    .execute();
  return rows.map((row) => ({
    name: row.name,
    price: Number(row.price),
    platformFeePercentage: Number(row.platformFeePercentage),
  }));
}

/** Claims a send so a parallel or later run cannot send it again. Returns false when it is taken. */
async function claimSend(teacherId: number, key: OnboardingEmailKey): Promise<boolean> {
  const result = await sql`
    INSERT INTO teacher_onboarding_emails (teacher_id, email_key, status, attempts)
    VALUES (${teacherId}, ${key}, 'sending', 1)
    ON CONFLICT (teacher_id, email_key) DO UPDATE
      SET status = 'sending', attempts = teacher_onboarding_emails.attempts + 1, reason = NULL, updated_at = now()
      WHERE teacher_onboarding_emails.status = 'failed'
        AND teacher_onboarding_emails.attempts < ${ONBOARDING_TIMING.maxAttempts}
    RETURNING id`.execute(db);
  return result.rows.length > 0;
}

async function recordSkips(rows: { teacherId: number; key: OnboardingEmailKey; reason: string }[]) {
  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    await db
      .insertInto("teacherOnboardingEmails")
      .values(chunk.map((row) => ({ teacherId: row.teacherId, emailKey: row.key, status: "skipped", reason: row.reason })))
      .onConflict((oc) =>
        oc
          .columns(["teacherId", "emailKey"])
          .doUpdateSet((eb) => ({ status: "skipped", reason: eb.ref("excluded.reason"), updatedAt: new Date() }))
          .where("teacherOnboardingEmails.status", "=", "failed")
      )
      .execute();
  }
}

export async function runTeacherOnboarding({
  now,
  dryRun,
}: {
  now: Date;
  dryRun: boolean;
}): Promise<TeacherOnboardingRunSummary> {
  const enrolled = dryRun ? 0 : await enrolTeachers(now);
  const candidates = await loadCandidates(now, dryRun);
  const sendsByTeacher = await loadSends(candidates.map((row) => row.teacherId));

  const entries: (TeacherOnboardingPlanEntry & { row: CandidateRow })[] = candidates.map((row) => {
    const detectedPublish =
      row.firstPublishedAt ?? row.publishEvidenceAt ?? (row.hasListing ? now : null);
    const plan = planOnboarding(
      {
        signedUpAt: row.signedUpAt,
        enrolledAt: row.enrolledAt ?? now,
        firstPublishedAt: detectedPublish,
        profileComplete: teacherProfileCompleteness(row).percent === 100,
        hasBankDetails: row.hasBankDetails,
        sends: sendsByTeacher.get(row.teacherId) ?? [],
      },
      now
    );
    return {
      row,
      teacherId: row.teacherId,
      newlyEnrolled: row.enrolledAt === null,
      newlyPublishedAt: row.firstPublishedAt ? null : detectedPublish,
      plan,
    };
  });

  const skips = entries.flatMap((entry) =>
    entry.plan.skip.map((item) => ({ teacherId: entry.teacherId, key: item.key, reason: item.reason }))
  );
  const due = entries
    .filter((entry) => entry.plan.send)
    .sort((a, b) => a.plan.due[a.plan.send!].getTime() - b.plan.due[b.plan.send!].getTime())
    .slice(0, MAX_SENDS_PER_RUN);

  if (dryRun) {
    return {
      enrolled: entries.filter((entry) => entry.newlyEnrolled).length,
      publishesRecorded: entries.filter((entry) => entry.newlyPublishedAt).length,
      skipped: skips.length,
      sent: due.length,
      failed: 0,
      plans: entries.map(({ row: _row, ...entry }) => entry),
    };
  }

  let publishesRecorded = 0;
  for (const entry of entries) {
    if (!entry.newlyPublishedAt) continue;
    await db
      .updateTable("teacherOnboarding")
      .set({ firstPublishedAt: entry.newlyPublishedAt })
      .where("teacherId", "=", entry.teacherId)
      .where("firstPublishedAt", "is", null)
      .execute();
    publishesRecorded++;
  }

  await recordSkips(skips);

  const plans = due.length > 0 ? await loadPlans() : [];
  let sent = 0;
  let failed = 0;

  for (const entry of due) {
    const key = entry.plan.send!;
    if (!(await claimSend(entry.teacherId, key))) continue;

    let status: "sent" | "failed" = "failed";
    let reason: string | null = null;
    let resendEmailId: string | null = null;
    try {
      const email = renderTeacherOnboardingEmail(key, {
        published: Boolean(entry.row.firstPublishedAt ?? entry.newlyPublishedAt),
        plans,
        unsubscribeUrl: unsubscribePageUrl(entry.teacherId, LIST),
      });
      const result = await sendEmail({
        to: entry.row.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        fromName: FROM_NAME,
        replyTo: REPLY_TO,
        headers: unsubscribeHeaders(entry.teacherId, LIST),
        tags: [
          { name: "sequence", value: LIST },
          { name: "email", value: key },
        ],
        idempotencyKey: `teacher-onboarding-${entry.teacherId}-${key}`,
      });
      if (result.success) {
        status = "sent";
        resendEmailId = result.data?.data?.id ?? null;
      } else {
        reason = String(result.error?.message ?? result.error ?? "Send failed").slice(0, 500);
      }
    } catch (error) {
      reason = String(error instanceof Error ? error.message : error).slice(0, 500);
    }

    await db
      .updateTable("teacherOnboardingEmails")
      .set({ status, reason, resendEmailId, updatedAt: new Date() })
      .where("teacherId", "=", entry.teacherId)
      .where("emailKey", "=", key)
      .execute();

    if (status === "sent") sent++;
    else {
      failed++;
      console.error(`Teacher onboarding ${key} failed for teacher ${entry.teacherId}: ${reason}`);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_SPACING_MS));
  }

  return { enrolled, publishesRecorded, skipped: skips.length, sent, failed };
}

export async function teacherOnboarding() {
  try {
    const summary = await runTeacherOnboarding({ now: new Date(), dryRun: false });
    console.log(
      `Teacher onboarding: enrolled ${summary.enrolled}, publishes recorded ${summary.publishesRecorded}, skipped ${summary.skipped}, sent ${summary.sent}, failed ${summary.failed}.`
    );
  } catch (error) {
    console.error("Teacher onboarding run failed:", error);
  }
}
