import type { Kysely, Transaction } from "kysely";
import superjson from "superjson";
import type { ContentVisibility, DB } from "./schema";
import type { BundleItemIds } from "./bundlePricing";

type Executor = Kysely<DB> | Transaction<DB>;

export type BundledItemKind = "course" | "test" | "digital_product";

export type AffectedBundle = { id: number; title: string; visibility: ContentVisibility };

export const BUNDLE_CONFIRMATION_CODE = "BUNDLE_CONFIRMATION_REQUIRED";

const ITEM_COLUMN = {
  course: "courseId",
  test: "mockTestId",
  digital_product: "digitalProductId",
} as const;

/*
 * A bundle only goes live when every item in it is live, so taking an item off
 * the store has to take the published bundles that hold it down in the same
 * transaction. Live tests cannot be bundled (bundle_item_type has no such
 * value), so their unpublish never comes through here.
 *
 * Draft bundles are left alone: they are already off the store. teacherId
 * narrows the lookup for teacher-facing reads; the unpublish itself passes none,
 * so every published bundle holding the item goes down with it.
 *
 * A public bundle lists its items to everyone, so it may only hold items that
 * are published and public. An unlisted bundle may also hold unlisted items.
 */
export async function findPublishedBundlesContaining(
  executor: Executor,
  kind: BundledItemKind,
  itemIds: number[],
  options: { teacherId?: number; visibility?: ContentVisibility } = {}
): Promise<AffectedBundle[]> {
  const ids = Array.from(new Set(itemIds));
  if (ids.length === 0) return [];

  const column = ITEM_COLUMN[kind];
  let query = executor
    .selectFrom("courseBundles")
    .innerJoin("courseBundleItems", "courseBundleItems.bundleId", "courseBundles.id")
    .select(["courseBundles.id", "courseBundles.title", "courseBundles.visibility"])
    .where("courseBundles.isPublished", "=", true)
    .where("courseBundleItems.itemType", "=", kind)
    .where(`courseBundleItems.${column}`, "in", ids)
    .distinct()
    .orderBy("courseBundles.id");

  if (options.teacherId !== undefined) {
    query = query.where("courseBundles.teacherId", "=", options.teacherId);
  }
  if (options.visibility !== undefined) {
    query = query.where("courseBundles.visibility", "=", options.visibility);
  }

  return query.execute();
}

/**
 * How many of a bundle's items students cannot buy on their own right now. With
 * requirePublic, a published but unlisted item counts as unavailable too.
 */
export async function countUnavailableBundleItems(
  executor: Executor,
  ids: BundleItemIds,
  requirePublic: boolean
): Promise<number> {
  const courseIds = Array.from(new Set(ids.courseIds));
  const testIds = Array.from(new Set(ids.testIds));
  const digitalProductIds = Array.from(new Set(ids.digitalProductIds));
  let live = 0;
  if (courseIds.length > 0) {
    let query = executor.selectFrom("courses").select("id").where("id", "in", courseIds).where("status", "=", "published");
    if (requirePublic) query = query.where("visibility", "=", "public");
    live += (await query.execute()).length;
  }
  if (testIds.length > 0) {
    let query = executor
      .selectFrom("mockTests")
      .select("id")
      .where("id", "in", testIds)
      .where("isPublished", "=", true)
      .where("deletedAt", "is", null);
    if (requirePublic) query = query.where("visibility", "=", "public");
    live += (await query.execute()).length;
  }
  if (digitalProductIds.length > 0) {
    let query = executor
      .selectFrom("digitalProducts")
      .select("id")
      .where("id", "in", digitalProductIds)
      .where("status", "=", "published");
    if (requirePublic) query = query.where("visibility", "=", "public");
    live += (await query.execute()).length;
  }
  return courseIds.length + testIds.length + digitalProductIds.length - live;
}

/** The course, test and study note ids a bundle holds. */
export async function loadBundleItemIds(executor: Executor, bundleId: number): Promise<BundleItemIds & { count: number }> {
  const items = await executor
    .selectFrom("courseBundleItems")
    .select(["itemType", "courseId", "mockTestId", "digitalProductId"])
    .where("bundleId", "=", bundleId)
    .execute();
  return {
    count: items.length,
    courseIds: items.filter((i) => i.itemType === "course" && i.courseId !== null).map((i) => i.courseId as number),
    testIds: items.filter((i) => i.itemType === "test" && i.mockTestId !== null).map((i) => i.mockTestId as number),
    digitalProductIds: items
      .filter((i) => i.itemType === "digital_product" && i.digitalProductId !== null)
      .map((i) => i.digitalProductId as number),
  };
}

/** Takes the given bundles off the store, the same way a teacher's own bundle unpublish does. */
export async function unpublishBundles(
  trx: Transaction<DB>,
  bundles: AffectedBundle[],
  now: Date = new Date()
): Promise<void> {
  if (bundles.length === 0) return;
  await trx
    .updateTable("courseBundles")
    .set({ isPublished: false, publishedAt: null, updatedAt: now })
    .where(
      "id",
      "in",
      bundles.map((bundle) => bundle.id)
    )
    .where("isPublished", "=", true)
    .execute();
}

/** Finds and unpublishes every published bundle holding the items. Returns the bundles it took down. */
export async function unpublishBundlesContaining(
  trx: Transaction<DB>,
  kind: BundledItemKind,
  itemIds: number[],
  now: Date = new Date()
): Promise<AffectedBundle[]> {
  const bundles = await findPublishedBundlesContaining(trx, kind, itemIds);
  await unpublishBundles(trx, bundles, now);
  return bundles;
}

/*
 * Nothing has changed when this is returned. The teacher screens ask first and
 * send confirmBundleUnpublish, so this only fires when a bundle was published
 * after that check, or for a caller that skipped it.
 */
export function bundleConfirmationResponse(bundles: AffectedBundle[]): Response {
  const noun = bundles.length === 1 ? "a published bundle" : `${bundles.length} published bundles`;
  return new Response(
    superjson.stringify({
      error: `This item is part of ${noun}. Unpublishing it also unpublishes the bundle. Confirm to continue.`,
      code: BUNDLE_CONFIRMATION_CODE,
      bundles,
    }),
    { status: 409 }
  );
}
