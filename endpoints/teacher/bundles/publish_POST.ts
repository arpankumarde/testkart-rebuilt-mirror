import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { computeBundlePricing, loadBundleItemPrices, type BundleItemIds } from "../../../helpers/bundlePricing";
import { clearOpenReviews } from "../../../helpers/contentReviewQueue";

// How many of the bundle's items students cannot buy on their own right now.
async function countUnpublishedItems(ids: BundleItemIds): Promise<number> {
  const courseIds = Array.from(new Set(ids.courseIds));
  const testIds = Array.from(new Set(ids.testIds));
  const digitalProductIds = Array.from(new Set(ids.digitalProductIds));
  let live = 0;
  if (courseIds.length > 0) {
    const rows = await db
      .selectFrom("courses")
      .select("id")
      .where("id", "in", courseIds)
      .where("status", "=", "published")
      .execute();
    live += rows.length;
  }
  if (testIds.length > 0) {
    const rows = await db
      .selectFrom("mockTests")
      .select("id")
      .where("id", "in", testIds)
      .where("isPublished", "=", true)
      .where("deletedAt", "is", null)
      .execute();
    live += rows.length;
  }
  if (digitalProductIds.length > 0) {
    const rows = await db
      .selectFrom("digitalProducts")
      .select("id")
      .where("id", "in", digitalProductIds)
      .where("status", "=", "published")
      .execute();
    live += rows.length;
  }
  return courseIds.length + testIds.length + digitalProductIds.length - live;
}

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

    const bundle = await db
      .selectFrom("courseBundles")
      .select(["id", "teacherId", "price"])
      .where("id", "=", input.bundleId)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!bundle) {
      return new Response(
        superjson.stringify({ error: "Bundle not found or you do not have permission to publish it." }),
        { status: 404 }
      );
    }

    // Unpublishing skips the item and price checks below
    if (!input.publish) {
      await db
        .updateTable("courseBundles")
        .set({
          isPublished: false,
          publishedAt: null,
        })
        .where("id", "=", input.bundleId)
        .execute();

      const output: OutputType = {
        success: true,
        message: "Course bundle unpublished successfully.",
      };
      return new Response(superjson.stringify(output));
    }

    const items = await db
      .selectFrom("courseBundleItems")
      .select(["itemType", "courseId", "mockTestId", "digitalProductId"])
      .where("bundleId", "=", input.bundleId)
      .execute();

    if (items.length < 2) {
      return new Response(
        superjson.stringify({ error: "A bundle must contain at least 2 items to be published." }),
        { status: 400 }
      );
    }

    const itemIds: BundleItemIds = {
      courseIds: items.filter((i) => i.itemType === "course" && i.courseId !== null).map((i) => i.courseId as number),
      testIds: items.filter((i) => i.itemType === "test" && i.mockTestId !== null).map((i) => i.mockTestId as number),
      digitalProductIds: items
        .filter((i) => i.itemType === "digital_product" && i.digitalProductId !== null)
        .map((i) => i.digitalProductId as number),
    };

    // Bundles skip content review and publish at once. That is safe only because
    // every item in them is already live, which for a teacher means an admin
    // approved it, so an unpublished item blocks publishing.
    const unpublished = await countUnpublishedItems(itemIds);
    if (unpublished > 0) {
      const one = unpublished === 1;
      return new Response(
        superjson.stringify({
          error: `${unpublished} ${one ? "item in this bundle is" : "items in this bundle are"} not published yet. A bundle can only go live with published items, so remove ${one ? "it" : "them"} or wait until ${one ? "it is" : "they are"} approved.`,
        }),
        { status: 400 }
      );
    }

    // Refresh the original price from the items' current prices, so the
    // strikethrough students see on a newly published bundle is real.
    const itemPrices = await loadBundleItemPrices(db, effectiveTeacherId, itemIds, false);
    const pricing = computeBundlePricing(itemPrices, Number(bundle.price));
    if (pricing.priceError) {
      return new Response(
        superjson.stringify({ error: `${pricing.priceError} Edit the bundle price, then publish.` }),
        { status: 400 }
      );
    }

    await db.transaction().execute(async (trx) => {
      // A review queued before bundles skipped review would otherwise linger.
      await clearOpenReviews(trx, "course_bundle", input.bundleId);
      await trx
        .updateTable("courseBundles")
        .set({
          isPublished: true,
          publishedAt: new Date(),
          originalPrice: pricing.originalPrice.toString(),
          discountPercentage: pricing.discountPercentage.toFixed(2),
        })
        .where("id", "=", input.bundleId)
        .execute();
    });

    console.log(`Course bundle ${input.bundleId} published by ${user.role} ${user.id}`);

    const output: OutputType = {
      success: true,
      message: "Your course bundle has been published successfully.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error publishing course bundle:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to publish course bundle", details: errorMessage }),
      { status: 500 }
    );
  }
}