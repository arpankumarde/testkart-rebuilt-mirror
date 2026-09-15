import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { computeBundlePricing, loadBundleItemPrices } from "../../../helpers/bundlePricing";

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

    // Refresh the original price from the items' current prices, so the
    // strikethrough students see on a newly published bundle is real.
    const itemPrices = await loadBundleItemPrices(
      db,
      effectiveTeacherId,
      {
        courseIds: items.filter((i) => i.itemType === "course" && i.courseId !== null).map((i) => i.courseId as number),
        testIds: items.filter((i) => i.itemType === "test" && i.mockTestId !== null).map((i) => i.mockTestId as number),
        digitalProductIds: items
          .filter((i) => i.itemType === "digital_product" && i.digitalProductId !== null)
          .map((i) => i.digitalProductId as number),
      },
      false
    );
    const pricing = computeBundlePricing(itemPrices, Number(bundle.price));
    if (pricing.priceError) {
      return new Response(
        superjson.stringify({ error: `${pricing.priceError} Edit the bundle price, then publish.` }),
        { status: 400 }
      );
    }

    await db
      .updateTable("courseBundles")
      .set({
        isPublished: true,
        publishedAt: new Date(),
        originalPrice: pricing.originalPrice.toString(),
        discountPercentage: pricing.discountPercentage.toFixed(2),
      })
      .where("id", "=", input.bundleId)
      .execute();

    console.log(`Course bundle ${input.bundleId} published by teacher ${bundle.teacherId}`);

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