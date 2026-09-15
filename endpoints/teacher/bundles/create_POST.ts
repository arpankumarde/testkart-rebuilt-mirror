import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import {
  BundleRuleError,
  computeBundlePricing,
  loadBundleItemPrices,
} from "../../../helpers/bundlePricing";

async function generateUniqueSlug(baseTitle: string): Promise<string> {
  const baseSlug = slugify(baseTitle);
  const existing = await db
    .selectFrom("courseBundles")
    .select("id")
    .where("slug", "=", baseSlug)
    .executeTakeFirst();

  if (!existing) {
    return baseSlug;
  }

  let counter = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const existingWithCounter = await db
      .selectFrom("courseBundles")
      .select("id")
      .where("slug", "=", candidateSlug)
      .executeTakeFirst();

    if (!existingWithCounter) {
      return candidateSlug;
    }
    counter++;
  }
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

    const courseIds = input.courseIds ?? [];
    const testIds = input.testIds ?? [];
    const digitalProductIds = input.digitalProductIds ?? [];
    const totalItems = courseIds.length + testIds.length + digitalProductIds.length;

    if (totalItems < 2) {
      return new Response(
        superjson.stringify({ error: "A bundle must contain at least 2 items total (courses, tests, and/or digital products)." }),
        { status: 400 }
      );
    }

    const slug = await generateUniqueSlug(input.title);

    const newBundle = await db.transaction().execute(async (trx) => {
      const itemPrices = await loadBundleItemPrices(
        trx,
        effectiveTeacherId,
        { courseIds, testIds, digitalProductIds },
        true
      );
      const pricing = computeBundlePricing(itemPrices, input.price);
      if (pricing.priceError) {
        throw new BundleRuleError(pricing.priceError);
      }

      const createdBundle = await trx
        .insertInto("courseBundles")
        .values({
          teacherId: effectiveTeacherId,
          title: input.title,
          slug: slug,
          description: input.description,
          price: input.price.toString(),
          originalPrice: pricing.originalPrice.toString(),
          discountPercentage: pricing.discountPercentage.toFixed(2),
          isPublished: false,
          thumbnailUrl: input.thumbnailUrl || null,
          thumbnailFileId: input.thumbnailUrl ? input.thumbnailFileId || null : null,
          introVideoUrl: input.introVideoUrl || null,
          introVideoFileId: input.introVideoUrl ? input.introVideoFileId || null : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Build bundle items array
      const bundleItems: Array<{
        bundleId: number;
        courseId: number | null;
        mockTestId: number | null;
        digitalProductId: number | null;
        itemType: "course" | "test" | "digital_product";
        orderIndex: number;
      }> = [];

      courseIds.forEach((courseId, index) => {
        bundleItems.push({
          bundleId: createdBundle.id,
          courseId: courseId,
          mockTestId: null,
          digitalProductId: null,
          itemType: "course",
          orderIndex: index,
        });
      });

      testIds.forEach((testId, index) => {
        bundleItems.push({
          bundleId: createdBundle.id,
          courseId: null,
          mockTestId: testId,
          digitalProductId: null,
          itemType: "test",
          orderIndex: courseIds.length + index,
        });
      });

      digitalProductIds.forEach((dpId, index) => {
        bundleItems.push({
          bundleId: createdBundle.id,
          courseId: null,
          mockTestId: null,
          digitalProductId: dpId,
          itemType: "digital_product",
          orderIndex: courseIds.length + testIds.length + index,
        });
      });

      if (bundleItems.length > 0) {
        await trx
          .insertInto("courseBundleItems")
          .values(bundleItems)
          .execute();
      }

      return createdBundle;
    });

    const output: OutputType = {
      ...newBundle,
      price: Number(newBundle.price),
      originalPrice: Number(newBundle.originalPrice),
      discountPercentage: newBundle.discountPercentage ? Number(newBundle.discountPercentage) : null,
      courseCount: totalItems,
    };

    return new Response(superjson.stringify(output), { status: 201 });
  } catch (error) {
    if (error instanceof BundleRuleError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    console.error("Error creating course bundle:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to create course bundle", details: errorMessage }),
      { status: 500 }
    );
  }
}