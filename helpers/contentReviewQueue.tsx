import type { Kysely, Transaction } from "kysely";
import type { ContentType, DB } from "./schema";
import { assertTeacherCanFundPrizePool } from "./liveTestPrizeFunding";
import { CONTENT_NOUNS, OPEN_REVIEW_STATUSES } from "./contentReviewStatus";

type Executor = Kysely<DB> | Transaction<DB>;

/*
 * Teacher content goes live only after an admin approves it. A teacher's
 * publish action queues a pending contentReviews row; admin/content-reviews
 * approves it (publishApprovedContent) or rejects it with a note. Admin users
 * publish directly. The admin preview page can also make any item live, move it
 * back to draft or reject it after it went live (takeDownContent).
 *
 * A review that a teammate could not decide moves to senior_review. It is still
 * waiting, so the helpers below count both statuses as "in review".
 *
 * A teacher can take an item back out of review (clearOpenReviews), and deleting
 * or trashing an item clears its waiting review the same way, so the queue never
 * holds a review for content that is gone.
 */

export const REVIEW_QUEUED_NOTE =
  "Our team will review it before students can see it. We will email you once it is approved or needs changes.";

export const alreadyInReviewMessage = (noun: string) =>
  `This ${noun} is already waiting for review. We will email you once it is approved or needs changes.`;

/** Thrown when a review's content no longer exists, so the review can be closed instead of approved. */
export class ContentGoneError extends Error {
  constructor(contentType: ContentType) {
    super(`This ${CONTENT_NOUNS[contentType]} no longer exists.`);
    this.name = "ContentGoneError";
  }
}

export const contentGoneMessage = (contentType: ContentType) =>
  `The teacher deleted this ${CONTENT_NOUNS[contentType]}, so it was removed from the review queue. No email was sent.`;

/** Queues content for admin review. Returns false when it is already waiting (pending or senior approval). */
export async function queueContentReview(
  executor: Executor,
  input: { contentType: ContentType; contentId: number; teacherId: number }
): Promise<boolean> {
  if (await hasPendingReview(executor, input.contentType, input.contentId)) return false;
  await executor
    .insertInto("contentReviews")
    .values({
      contentType: input.contentType,
      contentId: input.contentId,
      teacherId: input.teacherId,
    })
    .execute();
  return true;
}

export async function hasPendingReview(
  executor: Executor,
  contentType: ContentType,
  contentId: number
): Promise<boolean> {
  const row = await executor
    .selectFrom("contentReviews")
    .select("id")
    .where("contentType", "=", contentType)
    .where("contentId", "=", contentId)
    .where("status", "in", [...OPEN_REVIEW_STATUSES])
    .executeTakeFirst();
  return Boolean(row);
}

/** Removes an item's waiting reviews (pending or senior approval). Returns how many were removed. */
export async function clearOpenReviews(
  executor: Executor,
  contentType: ContentType,
  contentId: number
): Promise<number> {
  const result = await executor
    .deleteFrom("contentReviews")
    .where("contentType", "=", contentType)
    .where("contentId", "=", contentId)
    .where("status", "in", [...OPEN_REVIEW_STATUSES])
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}

/** Ids among contentIds that have a pending review, for teacher list badges. */
export async function pendingReviewIds(
  executor: Executor,
  contentType: ContentType,
  contentIds: number[]
): Promise<Set<number>> {
  if (contentIds.length === 0) return new Set();
  const rows = await executor
    .selectFrom("contentReviews")
    .select("contentId")
    .where("contentType", "=", contentType)
    .where("contentId", "in", contentIds)
    .where("status", "in", [...OPEN_REVIEW_STATUSES])
    .execute();
  return new Set(rows.map((row) => row.contentId));
}

/**
 * Puts approved content live. Throws with a reason an admin can act on when it
 * can no longer go live (trashed, schedule passed, prize pool not covered), and
 * ContentGoneError when the item was deleted.
 */
export async function publishApprovedContent(
  trx: Transaction<DB>,
  contentType: ContentType,
  contentId: number,
  now: Date
): Promise<void> {
  switch (contentType) {
    case "mock_test": {
      const test = await trx
        .selectFrom("mockTests")
        .select(["deletedAt"])
        .where("id", "=", contentId)
        .executeTakeFirst();
      if (!test) throw new ContentGoneError(contentType);
      if (test.deletedAt) throw new Error("The teacher moved this test series to the Trash.");
      await trx
        .updateTable("mockTests")
        .set({ isPublished: true, wasEverPublished: true, updatedAt: now })
        .where("id", "=", contentId)
        .execute();
      return;
    }

    case "course": {
      const result = await trx
        .updateTable("courses")
        .set({ status: "published", publishedAt: now, updatedAt: now })
        .where("id", "=", contentId)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new ContentGoneError(contentType);
      return;
    }

    case "digital_product": {
      const result = await trx
        .updateTable("digitalProducts")
        .set({ status: "published", isPublished: true, publishedAt: now, updatedAt: now })
        .where("id", "=", contentId)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new ContentGoneError(contentType);
      return;
    }

    case "course_bundle": {
      const result = await trx
        .updateTable("courseBundles")
        .set({ isPublished: true, publishedAt: now, updatedAt: now })
        .where("id", "=", contentId)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new ContentGoneError(contentType);
      return;
    }

    case "live_test": {
      const liveTest = await trx
        .selectFrom("liveTests")
        .selectAll()
        .where("id", "=", contentId)
        .executeTakeFirst();
      if (!liveTest) throw new ContentGoneError(contentType);
      if (
        (liveTest.registrationDeadline && liveTest.registrationDeadline <= now) ||
        (liveTest.startTime && liveTest.startTime <= now) ||
        liveTest.endTime <= now
      ) {
        throw new Error(
          "This live test's registration deadline or start time has passed. Reject it so the teacher can reschedule."
        );
      }
      await assertTeacherCanFundPrizePool(trx, liveTest);
      // Only the live test is activated. Its shadow mockTests row must stay
      // unpublished, or it shows up as a separate mock test on the marketplace.
      await trx
        .updateTable("liveTests")
        .set({ isActive: true, updatedAt: now })
        .where("id", "=", contentId)
        .execute();
      return;
    }
  }
}

export type ContentState = {
  teacherId: number;
  title: string;
  live: boolean;
  endTime: Date | null;
};

/** Owner, title and whether students can currently find and buy the item. */
export async function loadContentState(
  executor: Executor,
  contentType: ContentType,
  contentId: number
): Promise<ContentState | null> {
  switch (contentType) {
    case "mock_test": {
      const row = await executor
        .selectFrom("mockTests")
        .select(["teacherId", "title", "isPublished", "deletedAt"])
        .where("id", "=", contentId)
        .executeTakeFirst();
      return row ? { teacherId: row.teacherId, title: row.title, live: row.isPublished && !row.deletedAt, endTime: null } : null;
    }
    case "course": {
      const row = await executor
        .selectFrom("courses")
        .select(["teacherId", "title", "status"])
        .where("id", "=", contentId)
        .executeTakeFirst();
      return row ? { teacherId: row.teacherId, title: row.title, live: row.status === "published", endTime: null } : null;
    }
    case "digital_product": {
      const row = await executor
        .selectFrom("digitalProducts")
        .select(["teacherId", "title", "status"])
        .where("id", "=", contentId)
        .executeTakeFirst();
      return row ? { teacherId: row.teacherId, title: row.title, live: row.status === "published", endTime: null } : null;
    }
    case "course_bundle": {
      const row = await executor
        .selectFrom("courseBundles")
        .select(["teacherId", "title", "isPublished"])
        .where("id", "=", contentId)
        .executeTakeFirst();
      return row ? { teacherId: row.teacherId, title: row.title, live: row.isPublished, endTime: null } : null;
    }
    case "live_test": {
      const row = await executor
        .selectFrom("liveTests")
        .select(["teacherId", "title", "isActive", "endTime"])
        .where("id", "=", contentId)
        .executeTakeFirst();
      return row ? { teacherId: row.teacherId, title: row.title, live: row.isActive, endTime: row.endTime } : null;
    }
  }
}

/**
 * Takes live content off the store the same way the teacher's own unpublish
 * does. Students who already bought it keep access; carts drop it.
 */
export async function takeDownContent(
  trx: Transaction<DB>,
  contentType: ContentType,
  contentId: number,
  now: Date
): Promise<void> {
  switch (contentType) {
    case "mock_test":
      await trx.updateTable("mockTests").set({ isPublished: false, updatedAt: now }).where("id", "=", contentId).execute();
      await trx.deleteFrom("cartItems").where("mockTestId", "=", contentId).execute();
      return;
    case "course":
      await trx.updateTable("courses").set({ status: "draft", updatedAt: now }).where("id", "=", contentId).execute();
      await trx.deleteFrom("cartItems").where("courseId", "=", contentId).execute();
      return;
    case "digital_product":
      await trx
        .updateTable("digitalProducts")
        .set({ status: "draft", isPublished: false, updatedAt: now })
        .where("id", "=", contentId)
        .execute();
      await trx.deleteFrom("cartItems").where("digitalProductId", "=", contentId).execute();
      return;
    case "course_bundle":
      await trx
        .updateTable("courseBundles")
        .set({ isPublished: false, publishedAt: null, updatedAt: now })
        .where("id", "=", contentId)
        .execute();
      return;
    case "live_test":
      await trx.updateTable("liveTests").set({ isActive: false, updatedAt: now }).where("id", "=", contentId).execute();
      return;
  }
}
