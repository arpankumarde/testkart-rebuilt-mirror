import type { Kysely, Transaction } from "kysely";
import superjson from "superjson";
import type { DB } from "./schema";

type Executor = Kysely<DB> | Transaction<DB>;

export type BundledItemKind = "course" | "test" | "digital_product";

export type AffectedBundle = { id: number; title: string };

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
 */
export async function findPublishedBundlesContaining(
  executor: Executor,
  kind: BundledItemKind,
  itemIds: number[],
  options: { teacherId?: number } = {}
): Promise<AffectedBundle[]> {
  const ids = Array.from(new Set(itemIds));
  if (ids.length === 0) return [];

  const column = ITEM_COLUMN[kind];
  let query = executor
    .selectFrom("courseBundles")
    .innerJoin("courseBundleItems", "courseBundleItems.bundleId", "courseBundles.id")
    .select(["courseBundles.id", "courseBundles.title"])
    .where("courseBundles.isPublished", "=", true)
    .where("courseBundleItems.itemType", "=", kind)
    .where(`courseBundleItems.${column}`, "in", ids)
    .distinct()
    .orderBy("courseBundles.id");

  if (options.teacherId !== undefined) {
    query = query.where("courseBundles.teacherId", "=", options.teacherId);
  }

  return query.execute();
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
