import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { computeBundlePricing, loadBundleItemPrices, type BundleItemIds } from "../../../helpers/bundlePricing";
import { clearOpenReviews } from "../../../helpers/contentReviewQueue";
import { countUnavailableBundleItems } from "../../../helpers/bundleDependencies";

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
      .select(["id", "teacherId", "price", "visibility"])
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
    // every item in them is already live, which for a public item means an admin
    // approved it, so an unpublished item blocks publishing. A public bundle lists
    // its items to everyone, so it may not hold unlisted (unreviewed) items either.
    const isPublic = bundle.visibility === "public";
    const unpublished = await countUnavailableBundleItems(db, itemIds, isPublic);
    if (unpublished > 0) {
      const one = unpublished === 1;
      return new Response(
        superjson.stringify({
          error: isPublic
            ? `${unpublished} ${one ? "item in this bundle is" : "items in this bundle are"} unlisted or not published yet. A public bundle can only go live with public, published items, so remove ${one ? "it" : "them"}, wait until ${one ? "it is" : "they are"} approved, or make the bundle unlisted.`
            : `${unpublished} ${one ? "item in this bundle is" : "items in this bundle are"} not published yet. A bundle can only go live with published items, so remove ${one ? "it" : "them"} or wait until ${one ? "it is" : "they are"} published.`,
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
      message: isPublic
        ? "Your course bundle has been published successfully."
        : "Your course bundle is live as unlisted. Anyone with its link can open and buy it; it stays out of search and listings.",
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