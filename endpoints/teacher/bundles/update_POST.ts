import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import {
  BundleRuleError,
  computeBundlePricing,
  loadBundleItemPrices,
} from "../../../helpers/bundlePricing";

const sameIds = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((val, index) => val === sortedB[index]);
};

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const updatedBundle = await db.transaction().execute(async (trx) => {
      const bundle = await trx
        .selectFrom("courseBundles")
        .selectAll()
        .where("id", "=", input.bundleId)
        .where("teacherId", "=", effectiveTeacherId)
        .executeTakeFirst();

      if (!bundle) {
        throw new BundleRuleError("Bundle not found or you do not have permission to edit it.");
      }

      const existingItems = await trx
        .selectFrom("courseBundleItems")
        .select(["courseId", "mockTestId", "digitalProductId", "itemType"])
        .where("bundleId", "=", input.bundleId)
        .execute();

      const existing = {
        courseIds: existingItems
          .filter((item) => item.itemType === "course" && item.courseId !== null)
          .map((item) => item.courseId as number),
        testIds: existingItems
          .filter((item) => item.itemType === "test" && item.mockTestId !== null)
          .map((item) => item.mockTestId as number),
        digitalProductIds: existingItems
          .filter((item) => item.itemType === "digital_product" && item.digitalProductId !== null)
          .map((item) => item.digitalProductId as number),
      };

      // An omitted list keeps that item type as it is.
      const next = {
        courseIds: input.courseIds ?? existing.courseIds,
        testIds: input.testIds ?? existing.testIds,
        digitalProductIds: input.digitalProductIds ?? existing.digitalProductIds,
      };

      const itemsBeingChanged =
        !sameIds(next.courseIds, existing.courseIds) ||
        !sameIds(next.testIds, existing.testIds) ||
        !sameIds(next.digitalProductIds, existing.digitalProductIds);

      if (bundle.isPublished && itemsBeingChanged) {
        throw new BundleRuleError("Cannot change items of a published bundle. Unpublish it first.");
      }

      let slug = bundle.slug;
      if (input.slug && input.slug !== bundle.slug) {
        const taken = await trx
          .selectFrom("courseBundles")
          .select("id")
          .where("slug", "=", input.slug)
          .where("id", "!=", input.bundleId)
          .executeTakeFirst();
        if (taken) {
          throw new BundleRuleError("This slug is already in use.");
        }
        slug = input.slug;
      } else if (input.title && input.title !== bundle.title && !bundle.isPublished) {
        // A published bundle keeps its slug so its live URL does not break.
        slug = slugify(input.title);
        const taken = await trx
          .selectFrom("courseBundles")
          .select("id")
          .where("slug", "=", slug)
          .where("id", "!=", input.bundleId)
          .executeTakeFirst();
        if (taken) {
          slug = `${slug}-${bundle.id}`;
        }
      }

      if (itemsBeingChanged) {
        const totalItems = next.courseIds.length + next.testIds.length + next.digitalProductIds.length;
        if (totalItems < 2) {
          throw new BundleRuleError("A bundle must contain at least 2 items total (courses, tests, and/or digital products).");
        }
      }

      // Original price always comes from the items' current prices, not the
      // value stored when the bundle was last saved.
      const itemPrices = await loadBundleItemPrices(trx, effectiveTeacherId, next, itemsBeingChanged);
      const price = input.price !== undefined ? input.price : Number(bundle.price);
      const pricing = computeBundlePricing(itemPrices, price);
      if (pricing.priceError) {
        throw new BundleRuleError(pricing.priceError);
      }

      if (itemsBeingChanged) {
        await trx
          .deleteFrom("courseBundleItems")
          .where("bundleId", "=", input.bundleId)
          .execute();

        const bundleItems = [
          ...next.courseIds.map((courseId) => ({
            bundleId: input.bundleId,
            courseId,
            mockTestId: null,
            digitalProductId: null,
            itemType: "course" as const,
          })),
          ...next.testIds.map((testId) => ({
            bundleId: input.bundleId,
            courseId: null,
            mockTestId: testId,
            digitalProductId: null,
            itemType: "test" as const,
          })),
          ...next.digitalProductIds.map((dpId) => ({
            bundleId: input.bundleId,
            courseId: null,
            mockTestId: null,
            digitalProductId: dpId,
            itemType: "digital_product" as const,
          })),
        ].map((item, orderIndex) => ({ ...item, orderIndex }));

        if (bundleItems.length > 0) {
          await trx.insertInto("courseBundleItems").values(bundleItems).execute();
        }
      }

      // Uploaders clear a file with either "" or null; both are stored as null.
      // Replacing a file never deletes the old object here: duplicated content
      // can share file ids, so an orphaned object is the accepted cost.
      const orNull = (value: string | null | undefined) => (value ? value : null);
      const media: Record<string, string | null> = {};
      if (input.thumbnailUrl !== undefined) media.thumbnailUrl = orNull(input.thumbnailUrl);
      if (input.thumbnailFileId !== undefined) media.thumbnailFileId = orNull(input.thumbnailFileId);
      if (input.thumbnailUrl !== undefined && !input.thumbnailUrl) media.thumbnailFileId = null;
      if (input.introVideoUrl !== undefined) media.introVideoUrl = orNull(input.introVideoUrl);
      if (input.introVideoFileId !== undefined) media.introVideoFileId = orNull(input.introVideoFileId);
      if (input.introVideoUrl !== undefined && !input.introVideoUrl) media.introVideoFileId = null;

      return trx
        .updateTable("courseBundles")
        .set({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...media,
          price: price.toString(),
          originalPrice: pricing.originalPrice.toString(),
          discountPercentage: pricing.discountPercentage.toFixed(2),
          slug,
        })
        .where("id", "=", input.bundleId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });

    const courseCountResult = await db
      .selectFrom("courseBundleItems")
      .where("bundleId", "=", input.bundleId)
      .select(db.fn.count("id").as("count"))
      .executeTakeFirst();

    const output: OutputType = {
      ...updatedBundle,
      price: Number(updatedBundle.price),
      originalPrice: Number(updatedBundle.originalPrice),
      discountPercentage: updatedBundle.discountPercentage
        ? Number(updatedBundle.discountPercentage)
        : null,
      courseCount: Number(courseCountResult?.count ?? 0),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof BundleRuleError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    console.error("Error updating course bundle:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to update course bundle", details: errorMessage }),
      { status: 500 }
    );
  }
}
