import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType, BundleDetailItem } from "./details_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const bundleIdStr = url.searchParams.get("bundleId");
    
    if (!bundleIdStr) {
      return new Response(
        superjson.stringify({ error: "bundleId is required" }),
        { status: 400 }
      );
    }

    const input = schema.parse({
      bundleId: Number(bundleIdStr),
    });

    const bundle = await db
      .selectFrom("courseBundles")
      .selectAll()
      .where("id", "=", input.bundleId)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!bundle) {
      return new Response(
        superjson.stringify({ error: "Bundle not found or you do not have permission to view it." }),
        { status: 404 }
      );
    }

    const items = await db
      .selectFrom("courseBundleItems")
      .select(["itemType", "courseId", "mockTestId", "digitalProductId"])
      .where("bundleId", "=", input.bundleId)
      .execute();

    const courseIds: number[] = [];
    const testIds: number[] = [];
    const digitalProductIds: number[] = [];

    for (const item of items) {
      if (item.itemType === "course" && item.courseId !== null) {
        courseIds.push(item.courseId);
      } else if (item.itemType === "test" && item.mockTestId !== null) {
        testIds.push(item.mockTestId);
      } else if (item.itemType === "digital_product" && item.digitalProductId !== null) {
        digitalProductIds.push(item.digitalProductId);
      }
    }

    const [courseRows, testRows, productRows] = await Promise.all([
      courseIds.length > 0
        ? db.selectFrom("courses").select(["id", "title", "price", "status"]).where("id", "in", courseIds).execute()
        : Promise.resolve([]),
      testIds.length > 0
        ? db.selectFrom("mockTests").select(["id", "title", "price", "isPublished"]).where("id", "in", testIds).execute()
        : Promise.resolve([]),
      digitalProductIds.length > 0
        ? db.selectFrom("digitalProducts").select(["id", "title", "price", "status"]).where("id", "in", digitalProductIds).execute()
        : Promise.resolve([]),
    ]);

    const detailItems: BundleDetailItem[] = [
      ...courseRows.map((c) => ({ itemType: "course" as const, id: c.id, title: c.title, price: Number(c.price), isPublished: c.status === "published" })),
      ...testRows.map((t) => ({ itemType: "test" as const, id: t.id, title: t.title, price: Number(t.price), isPublished: !!t.isPublished })),
      ...productRows.map((p) => ({ itemType: "digital_product" as const, id: p.id, title: p.title, price: Number(p.price), isPublished: p.status === "published" })),
    ];

    const output: OutputType = {
      ...bundle,
      price: Number(bundle.price),
      originalPrice: Number(bundle.originalPrice),
      discountPercentage: bundle.discountPercentage ? Number(bundle.discountPercentage) : null,
      courseIds,
      testIds,
      digitalProductIds,
      itemCount: items.length,
      items: detailItems,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching bundle details:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch bundle details", details: errorMessage }),
      { status: 500 }
    );
  }
}