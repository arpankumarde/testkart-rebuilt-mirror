import { db } from "../../helpers/db";
import { OutputType, schema } from "./details_GET.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { PRODUCT_DISCLAIMER } from "../../helpers/productDisclaimer";
import { computeBundleSeo } from "../../helpers/seoIndexability";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const validation = schema.safeParse({ slug });

    if (!validation.success || !validation.data.slug) {
      return new Response(
        superjson.stringify({ error: "Invalid bundle slug" }),
        { status: 400 }
      );
    }

    const bundle = await db
      .selectFrom("courseBundles")
      .innerJoin("users", "users.id", "courseBundles.teacherId")
      .selectAll("courseBundles")
      .select([
        "users.id as teacherId",
        "users.displayName as teacherDisplayName",
        "users.avatarUrl as teacherProfilePicture",
      ])
      .where("courseBundles.slug", "=", validation.data.slug)
      .where("courseBundles.isPublished", "=", true)
      .executeTakeFirst();

    if (!bundle) {
      return new Response(
        superjson.stringify({ error: "Bundle not found or not published" }),
        { status: 404 }
      );
    }

    let isEnrolled = false;
    try {
      const { user } = await getServerUserSession(request);
      const enrollment = await db
        .selectFrom("bundleEnrollments")
        .select("id")
        .where("bundleId", "=", bundle.id)
        .where("studentId", "=", user.id)
        .executeTakeFirst();
      isEnrolled = !!enrollment;
    } catch (error) {
      // User is not authenticated, isEnrolled remains false
    }

    // Fetch courses in bundle
    const coursesInBundle = await db
      .selectFrom("courseBundleItems")
      .innerJoin("courses", "courses.id", "courseBundleItems.courseId")
      .select([
        "courses.id",
        "courses.title",
        "courses.slug",
        "courses.description",
        "courses.thumbnailUrl",
        "courses.price",
        "courses.level",
        "courses.language",
        "courses.status",
        "courseBundleItems.orderIndex",
      ])
      .where("courseBundleItems.bundleId", "=", bundle.id)
      .where("courseBundleItems.itemType", "=", "course")
      .execute();

    // Fetch digital products in bundle
    const digitalProductsInBundle = await db
      .selectFrom("courseBundleItems")
      .innerJoin("digitalProducts", "digitalProducts.id", "courseBundleItems.digitalProductId")
      .select([
        "digitalProducts.id",
        "digitalProducts.title",
        "digitalProducts.slug",
        "digitalProducts.description",
        "digitalProducts.thumbnailUrl",
        "digitalProducts.price",
        "digitalProducts.language",
        "digitalProducts.pageCount",
        "digitalProducts.status",
        "courseBundleItems.orderIndex",
      ])
      .where("courseBundleItems.bundleId", "=", bundle.id)
      .where("courseBundleItems.itemType", "=", "digital_product")
      .execute();

    // Fetch tests in bundle
    const testsInBundle = await db
      .selectFrom("courseBundleItems")
      .innerJoin("mockTests", "mockTests.id", "courseBundleItems.mockTestId")
      .select([
        "mockTests.id",
        "mockTests.title",
        "mockTests.slug",
        "mockTests.description",
        "mockTests.thumbnailUrl",
        "mockTests.price",
        "mockTests.durationMinutes",
        "mockTests.totalQuestions",
        "mockTests.language",
        "mockTests.isPublished",
        "courseBundleItems.orderIndex",
      ])
      .where("courseBundleItems.bundleId", "=", bundle.id)
      .where("courseBundleItems.itemType", "=", "test")
      .execute();

    // Combine courses, tests, and digital products into items array
    const items: OutputType["items"] = [
      ...coursesInBundle.map((c) => ({
        type: "course" as const,
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        price: Number(c.price),
        level: c.level,
        language: c.language,
        orderIndex: c.orderIndex,
      })),
      ...testsInBundle.map((t) => ({
        type: "test" as const,
        id: t.id,
        title: t.title,
        slug: t.slug,
        description: t.description,
        thumbnailUrl: t.thumbnailUrl,
        price: Number(t.price),
        durationMinutes: t.durationMinutes,
        totalQuestions: t.totalQuestions,
        language: t.language,
        orderIndex: t.orderIndex,
      })),
      ...digitalProductsInBundle.map((d) => ({
        type: "digital_product" as const,
        id: d.id,
        title: d.title,
        slug: d.slug,
        description: d.description,
        thumbnailUrl: d.thumbnailUrl,
        price: Number(d.price),
        language: d.language,
        pageCount: d.pageCount,
        orderIndex: d.orderIndex,
      })),
    ];

    // Sort by orderIndex
    items.sort((a, b) => a.orderIndex - b.orderIndex);

    const publishedItemCount =
      coursesInBundle.filter((c) => c.status === "published").length +
      digitalProductsInBundle.filter((d) => d.status === "published").length +
      testsInBundle.filter((t) => t.isPublished).length;
    const distinctItemTypeCount = [
      coursesInBundle.length > 0,
      digitalProductsInBundle.length > 0,
      testsInBundle.length > 0,
    ].filter(Boolean).length;

    // Compute SEO indexability live from current data — see
    // helpers/seoIndexability.tsx for the full rule set and rationale.
    const seoResult = await computeBundleSeo(db, {
      id: bundle.id,
      title: bundle.title,
      description: bundle.description,
      isPublished: bundle.isPublished,
      itemCount: items.length,
      publishedItemCount,
      distinctItemTypeCount,
      discountPercentage: bundle.discountPercentage ? Number(bundle.discountPercentage) : null,
      thumbnailUrl: bundle.thumbnailUrl,
      introVideoUrl: bundle.introVideoUrl,
    });

    const output: OutputType = {
      ...bundle,
      description: bundle.description,
      price: Number(bundle.price),
      originalPrice: Number(bundle.originalPrice),
      discountPercentage: bundle.discountPercentage
        ? Number(bundle.discountPercentage)
        : null,
      teacher: {
        id: bundle.teacherId,
        displayName: bundle.teacherDisplayName,
        profilePicture: bundle.teacherProfilePicture,
      },
      items,
      isEnrolled,
      disclaimer: PRODUCT_DISCLAIMER,
      seo: {
        indexable: seoResult.indexable,
        qualityScore: seoResult.qualityScore,
        robots: seoResult.robots,
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching bundle details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch bundle details",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}