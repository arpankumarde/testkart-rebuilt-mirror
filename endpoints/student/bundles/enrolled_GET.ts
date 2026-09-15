import { db } from '../../../helpers/db';
import { getServerUserSession } from '../../../helpers/getServerUserSession';
import { OutputType } from "./enrolled_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    const enrolledBundles = await db.
    selectFrom("bundleEnrollments").
    innerJoin(
      "courseBundles",
      "courseBundles.id",
      "bundleEnrollments.bundleId"
    ).
    innerJoin("users", "users.id", "courseBundles.teacherId").
    select([
    "courseBundles.id",
    "courseBundles.title",
    "courseBundles.slug",
    "courseBundles.thumbnailUrl",
    "users.displayName as teacherName",
    "bundleEnrollments.enrolledAt"]
    ).
    where("bundleEnrollments.studentId", "=", user.id).
    orderBy("bundleEnrollments.enrolledAt", "desc").
    execute();

    if (enrolledBundles.length === 0) {
      return new Response(superjson.stringify({ enrolledBundles: [] }));
    }

    const bundleIds = enrolledBundles.map((b) => b.id);

    const coursesInBundles = await db.
    selectFrom("courseBundleItems").
    innerJoin("courses", "courses.id", "courseBundleItems.courseId").
    leftJoin("courseEnrollments", (join) =>
    join.
    onRef("courseEnrollments.courseId", "=", "courses.id").
    on("courseEnrollments.studentId", "=", user.id)
    ).
    select([
    "courseBundleItems.bundleId",
    "courses.id",
    "courses.title",
    "courses.slug",
    "courseEnrollments.completionPercentage",
    "courseEnrollments.lastAccessedAt"]
    ).
    where("courseBundleItems.bundleId", "in", bundleIds).
    where("courseBundleItems.itemType", "=", "course").
    execute();

    const mockTestsInBundles = await db.
    selectFrom("courseBundleItems").
    innerJoin("mockTests", "mockTests.id", "courseBundleItems.mockTestId").
    leftJoin("mockTestEnrollments", (join) =>
      join.
      onRef("mockTestEnrollments.mockTestId", "=", "mockTests.id").
      on("mockTestEnrollments.studentId", "=", user.id)
    ).
    select([
      "courseBundleItems.bundleId",
      "mockTests.id",
      "mockTests.title",
      "mockTests.slug",
      "mockTestEnrollments.id as enrollmentId"
    ]).
    where("courseBundleItems.bundleId", "in", bundleIds).
    where("courseBundleItems.itemType", "=", "test").
    execute();

    const digitalProductsInBundles = await db.
    selectFrom("courseBundleItems").
    innerJoin("digitalProducts", "digitalProducts.id", "courseBundleItems.digitalProductId").
    leftJoin("digitalProductPurchases", (join) =>
      join.
      onRef("digitalProductPurchases.productId", "=", "digitalProducts.id").
      on("digitalProductPurchases.studentId", "=", user.id)
    ).
    select([
      "courseBundleItems.bundleId",
      "digitalProducts.id",
      "digitalProducts.title",
      "digitalProducts.slug",
      "digitalProductPurchases.id as purchaseId"
    ]).
    where("courseBundleItems.bundleId", "in", bundleIds).
    where("courseBundleItems.itemType", "=", "digital_product").
    execute();

    const output: OutputType = {
      enrolledBundles: enrolledBundles.map((bundle) => {
        const courses = coursesInBundles.
        filter((c) => c.bundleId === bundle.id).
        map((c) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          completionPercentage: c.completionPercentage ?? undefined,
          lastAccessedAt: c.lastAccessedAt ?? undefined
        }));

        const mockTests = mockTestsInBundles.
        filter((t) => t.bundleId === bundle.id).
        map((t) => ({
          id: t.id,
          title: t.title,
          slug: t.slug,
          isEnrolled: !!t.enrollmentId
        }));

        const digitalProducts = digitalProductsInBundles.
        filter((p) => p.bundleId === bundle.id).
        map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          isPurchased: !!p.purchaseId
        }));

        return {
          id: bundle.id,
          title: bundle.title,
          slug: bundle.slug,
          thumbnailUrl: bundle.thumbnailUrl,
          teacherName: bundle.teacherName,
          enrolledAt: bundle.enrolledAt,
          courses,
          mockTests,
          digitalProducts
        };
      })
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to fetch enrolled bundles:", error);
    const errorMessage =
    error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch enrolled bundles.",
        details: errorMessage
      }),
      { status: 500 }
    );
  }
}