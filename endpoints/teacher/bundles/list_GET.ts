import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { pendingReviewIds } from "../../../helpers/contentReviewQueue";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const input = schema.parse({
      page: url.searchParams.get("page") ?? "1",
      limit: url.searchParams.get("limit") ?? "10",
      status: url.searchParams.get("status"),
    });

    const page = parseInt(input.page, 10);
    const limit = parseInt(input.limit, 10);
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("courseBundles")
      .where("courseBundles.teacherId", "=", effectiveTeacherId)
      .select((eb) => [
        "courseBundles.id",
        "courseBundles.title",
        "courseBundles.slug",
        "courseBundles.price",
        "courseBundles.originalPrice",
        "courseBundles.isPublished",
        "courseBundles.createdAt",
        "courseBundles.publishedAt",
        "courseBundles.thumbnailUrl",
        sql<number>`(SELECT COUNT(*) FROM course_bundle_items WHERE course_bundle_items.bundle_id = course_bundles.id)`.as("itemCount"),
        sql<string>`(
          SELECT COALESCE(SUM(COALESCE(c.price, t.price, d.price, 0)), 0)
          FROM course_bundle_items i
          LEFT JOIN courses c ON c.id = i.course_id AND i.item_type = 'course'
          LEFT JOIN mock_tests t ON t.id = i.mock_test_id AND i.item_type = 'test'
          LEFT JOIN digital_products d ON d.id = i.digital_product_id AND i.item_type = 'digital_product'
          WHERE i.bundle_id = course_bundles.id
        )`.as("currentOriginalPrice"),
      ]);

    if (input.status) {
      query = query.where("isPublished", "=", input.status === "published");
    }

    const bundles = await query
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let totalQuery = db
      .selectFrom("courseBundles")
      .where("teacherId", "=", effectiveTeacherId)
      .select(db.fn.count("id").as("total"));

    if (input.status) {
      totalQuery = totalQuery.where("isPublished", "=", input.status === "published");
    }

    const totalResult = await totalQuery.executeTakeFirstOrThrow();
    const inReview = await pendingReviewIds(db, "course_bundle", bundles.map((bundle) => bundle.id));

    const output: OutputType = {
      bundles: bundles.map(bundle => ({
        ...bundle,
        price: Number(bundle.price),
        originalPrice: Number(bundle.originalPrice),
        currentOriginalPrice: Math.round(Number(bundle.currentOriginalPrice) * 100) / 100,
        itemCount: Number(bundle.itemCount),
        inReview: inReview.has(bundle.id),
      })),
      total: Number(totalResult.total),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching course bundles:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch course bundles", details: errorMessage }),
      { status: 500 }
    );
  }
}