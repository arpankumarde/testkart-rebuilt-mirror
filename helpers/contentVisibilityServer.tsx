import type { Kysely, Transaction } from "kysely";
import { db } from "./db";
import type { ContentType, ContentVisibility, DB } from "./schema";
import {
  clearOpenReviews,
  hasPendingReview,
  loadContentState,
  publishesWithoutReview,
  queueContentReview,
} from "./contentReviewQueue";
import { CONTENT_NOUNS } from "./contentReviewStatus";
import {
  countUnavailableBundleItems,
  findPublishedBundlesContaining,
  loadBundleItemIds,
  type BundledItemKind,
} from "./bundleDependencies";

type Executor = Kysely<DB> | Transaction<DB>;

/*
 * Visibility changes for one teacher item (rules in helpers/contentVisibility).
 *
 * - A draft just records the choice; the publish endpoint reads it.
 * - Public to unlisted takes effect at once and withdraws any waiting review.
 *   An item a published public bundle holds must leave that bundle first,
 *   since the bundle page would keep listing it.
 * - Unlisted to public on a live item goes through review like any public
 *   publish. The item stays live and unlisted until the review is approved;
 *   publishApprovedContent then sets it public. Verified teachers, admins and
 *   bundles (whose items must all be public) switch at once.
 * - Asking again while a request waits is not an error: nothing new is queued
 *   and the teacher is told it is already with the team. A rejected request can
 *   be sent again; the item stays live and unlisted throughout.
 */

export class VisibilityChangeError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "VisibilityChangeError";
  }
}

export type VisibilityChangeResult = {
  visibility: ContentVisibility;
  /** True when the item now waits for review to become public. */
  inReview: boolean;
  /** True when a request was already waiting, so nothing new was queued. */
  alreadyInReview: boolean;
  title: string;
  message: string;
};

const BUNDLED_KIND: Partial<Record<ContentType, BundledItemKind>> = {
  mock_test: "test",
  course: "course",
  digital_product: "digital_product",
};

export async function writeContentVisibility(
  executor: Executor,
  contentType: ContentType,
  contentId: number,
  visibility: ContentVisibility
): Promise<void> {
  const updatedAt = new Date();
  switch (contentType) {
    case "mock_test":
      await executor.updateTable("mockTests").set({ visibility, updatedAt }).where("id", "=", contentId).execute();
      return;
    case "course":
      await executor.updateTable("courses").set({ visibility, updatedAt }).where("id", "=", contentId).execute();
      return;
    case "digital_product":
      await executor.updateTable("digitalProducts").set({ visibility, updatedAt }).where("id", "=", contentId).execute();
      return;
    case "course_bundle":
      await executor.updateTable("courseBundles").set({ visibility, updatedAt }).where("id", "=", contentId).execute();
      return;
    case "live_test": {
      // The shadow mockTests row mirrors it, so test-series queries that reach it stay filtered too.
      const row = await executor
        .updateTable("liveTests")
        .set({ visibility, updatedAt })
        .where("id", "=", contentId)
        .returning("mockTestId")
        .executeTakeFirst();
      if (row) {
        await executor.updateTable("mockTests").set({ visibility, updatedAt }).where("id", "=", row.mockTestId).execute();
      }
      return;
    }
  }
}

const titleList = (titles: string[]) => titles.map((t) => `"${t}"`).join(", ");

/** The item's own public URL path, the link a teacher shares for unlisted content. */
export async function loadContentPublicPath(
  executor: Executor,
  contentType: ContentType,
  contentId: number
): Promise<string | null> {
  switch (contentType) {
    case "mock_test": {
      const row = await executor.selectFrom("mockTests").select("slug").where("id", "=", contentId).executeTakeFirst();
      return row?.slug ? `/mock-test/${row.slug}` : null;
    }
    case "live_test": {
      const row = await executor
        .selectFrom("liveTests")
        .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
        .select("mockTests.slug")
        .where("liveTests.id", "=", contentId)
        .executeTakeFirst();
      return row?.slug ? `/live-test/${row.slug}` : null;
    }
    case "course": {
      const row = await executor.selectFrom("courses").select("slug").where("id", "=", contentId).executeTakeFirst();
      return row?.slug ? `/course/${row.slug}` : null;
    }
    case "digital_product": {
      const row = await executor.selectFrom("digitalProducts").select("slug").where("id", "=", contentId).executeTakeFirst();
      return row?.slug ? `/study-notes/${row.slug}` : null;
    }
    case "course_bundle": {
      const row = await executor.selectFrom("courseBundles").select("slug").where("id", "=", contentId).executeTakeFirst();
      return row?.slug ? `/bundles/${row.slug}` : null;
    }
  }
}

export async function changeContentVisibility(input: {
  contentType: ContentType;
  contentId: number;
  visibility: ContentVisibility;
  role: string;
  effectiveTeacherId: number;
}): Promise<VisibilityChangeResult> {
  const { contentType, contentId, visibility } = input;
  const noun = CONTENT_NOUNS[contentType];
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const state = await loadContentState(db, contentType, contentId);
  if (!state || (input.role !== "admin" && state.teacherId !== input.effectiveTeacherId)) {
    throw new VisibilityChangeError(`This ${noun} was not found in your account.`, 404);
  }
  const pending = await hasPendingReview(db, contentType, contentId);

  if (visibility === "unlisted") {
    if (state.visibility === "unlisted" && !pending) {
      return {
        visibility,
        inReview: false,
        alreadyInReview: false,
        title: "Nothing to change",
        message: `This ${noun} is already unlisted.`,
      };
    }
    const cancelledRequest = state.live && state.visibility === "unlisted";
    const kind = BUNDLED_KIND[contentType];
    if (kind && state.live && !cancelledRequest) {
      const bundles = await findPublishedBundlesContaining(db, kind, [contentId], { visibility: "public" });
      if (bundles.length > 0) {
        const one = bundles.length === 1;
        throw new VisibilityChangeError(
          `This ${noun} is part of the public ${one ? "bundle" : "bundles"} ${titleList(bundles.map((b) => b.title))}. Remove it from ${one ? "that bundle" : "those bundles"}, or make ${one ? "the bundle" : "them"} unlisted, before making it unlisted.`
        );
      }
    }
    await db.transaction().execute(async (trx) => {
      await clearOpenReviews(trx, contentType, contentId);
      await writeContentVisibility(trx, contentType, contentId, "unlisted");
    });
    const message = cancelledRequest
      ? `Your request to make this ${noun} public was cancelled. It stays live as unlisted.`
      : state.live
        ? `${Noun} is now unlisted. It no longer shows in search, listings or your profile, and its link still works.`
        : pending
          ? `${Noun} was taken out of review and is now unlisted. Publish it to put it live at once for anyone with the link.`
          : `${Noun} is set to unlisted. When you publish it, it goes live at once for anyone with the link.`;
    return {
      visibility: "unlisted",
      inReview: false,
      alreadyInReview: false,
      title: cancelledRequest ? "Request cancelled" : "Visibility updated",
      message,
    };
  }

  if (state.visibility === "public") {
    return {
      visibility,
      inReview: pending,
      alreadyInReview: false,
      title: "Nothing to change",
      message: `This ${noun} is already public.`,
    };
  }

  if (!state.live) {
    await writeContentVisibility(db, contentType, contentId, "public");
    return {
      visibility: "public",
      inReview: false,
      alreadyInReview: false,
      title: "Visibility updated",
      message: `${Noun} is set to public. Publishing it follows the usual review before it is listed.`,
    };
  }

  if (contentType === "course_bundle") {
    const ids = await loadBundleItemIds(db, contentId);
    const blocking = await countUnavailableBundleItems(db, ids, true);
    if (blocking > 0) {
      const one = blocking === 1;
      throw new VisibilityChangeError(
        `${blocking} ${one ? "item in this bundle is" : "items in this bundle are"} unlisted or not published. A public bundle can only hold public, published items, so make ${one ? "it" : "them"} public first or remove ${one ? "it" : "them"}.`
      );
    }
    await writeContentVisibility(db, contentType, contentId, "public");
    return {
      visibility: "public",
      inReview: false,
      alreadyInReview: false,
      title: "Visibility updated",
      message: "Bundle is now public. Students can find it in search and listings.",
    };
  }

  if (contentType === "live_test" && state.endTime && state.endTime <= new Date()) {
    throw new VisibilityChangeError("This live test has already ended, so it cannot be made public.");
  }

  if (await publishesWithoutReview(db, input.role, state.teacherId)) {
    if (pending) await clearOpenReviews(db, contentType, contentId);
    await writeContentVisibility(db, contentType, contentId, "public");
    return {
      visibility: "public",
      inReview: false,
      alreadyInReview: false,
      title: "Visibility updated",
      message: `${Noun} is now public. Students can find it in search, listings and your profile.`,
    };
  }

  const reviewId = pending ? null : await queueContentReview(db, { contentType, contentId, teacherId: state.teacherId });
  if (reviewId === null) {
    return {
      visibility: "unlisted",
      inReview: true,
      alreadyInReview: true,
      title: "Already waiting for review",
      message: `Your request to make this ${noun} public is with our team. It stays unlisted until the review is done, and we will email you the decision.`,
    };
  }
  return {
    visibility: "unlisted",
    inReview: true,
    alreadyInReview: false,
    title: "Your request has been submitted successfully!",
    message: `${Noun} stays unlisted until our team approves it. We will email you when the review is complete.`,
  };
}