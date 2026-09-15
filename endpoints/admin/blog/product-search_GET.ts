import { db } from "../../../helpers/db";
import { schema, OutputType, ProductSearchItem, ProductEmbedType } from "./product-search_GET.schema";
import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const input = schema.parse({
      query: url.searchParams.get("query") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const perTypeLimit = input.limit ?? (input.type ? 30 : 8);
    const searchPattern = input.query ? `%${input.query}%` : null;
    const wantType = (t: ProductEmbedType) => !input.type || input.type === t;

    const items: ProductSearchItem[] = [];

    if (wantType("mock_test")) {
      let q = db
        .selectFrom("mockTests")
        .innerJoin("users", "users.id", "mockTests.teacherId")
        .select([
          "mockTests.id",
          "mockTests.title",
          "mockTests.slug",
          "mockTests.thumbnailUrl",
          "mockTests.price",
          "mockTests.discountPrice",
          "mockTests.isFree",
          "users.displayName as teacherName",
        ])
        .where("mockTests.isPublished", "=", true)
        .where("mockTests.deletedAt", "is", null);
      if (searchPattern) {
        q = q.where("mockTests.title", "ilike", searchPattern);
      }
      const rows = await q.orderBy("mockTests.studentsEnrolled", "desc").limit(perTypeLimit).execute();
      for (const r of rows) {
        const price = parseFloat(r.price as unknown as string);
        const discountPrice = r.discountPrice ? parseFloat(r.discountPrice as unknown as string) : null;
        items.push({
          type: "mock_test",
          id: r.id,
          title: r.title,
          slug: r.slug,
          thumbnailUrl: r.thumbnailUrl,
          price: discountPrice ?? price,
          originalPrice: discountPrice != null && discountPrice < price ? price : null,
          teacherName: r.teacherName,
          isFree: !!r.isFree || price === 0,
        });
      }
    }

    if (wantType("digital_product")) {
      let q = db
        .selectFrom("digitalProducts")
        .innerJoin("users", "users.id", "digitalProducts.teacherId")
        .select([
          "digitalProducts.id",
          "digitalProducts.title",
          "digitalProducts.slug",
          "digitalProducts.thumbnailUrl",
          "digitalProducts.price",
          "users.displayName as teacherName",
        ])
        .where("digitalProducts.status", "=", "published");
      if (searchPattern) {
        q = q.where("digitalProducts.title", "ilike", searchPattern);
      }
      const rows = await q.orderBy("digitalProducts.totalPurchases", "desc").limit(perTypeLimit).execute();
      for (const r of rows) {
        const price = parseFloat(r.price as unknown as string);
        items.push({
          type: "digital_product",
          id: r.id,
          title: r.title,
          slug: r.slug,
          thumbnailUrl: r.thumbnailUrl,
          price,
          originalPrice: null,
          teacherName: r.teacherName,
          isFree: price === 0,
        });
      }
    }

    if (wantType("course")) {
      let q = db
        .selectFrom("courses")
        .innerJoin("users", "users.id", "courses.teacherId")
        .select([
          "courses.id",
          "courses.title",
          "courses.slug",
          "courses.thumbnailUrl",
          "courses.thumbnailImageUrl",
          "courses.price",
          "users.displayName as teacherName",
        ])
        .where("courses.status", "=", "published");
      if (searchPattern) {
        q = q.where("courses.title", "ilike", searchPattern);
      }
      const rows = await q.orderBy("courses.views", "desc").limit(perTypeLimit).execute();
      for (const r of rows) {
        const price = parseFloat(r.price as unknown as string);
        items.push({
          type: "course",
          id: r.id,
          title: r.title,
          slug: r.slug,
          thumbnailUrl: r.thumbnailImageUrl ?? r.thumbnailUrl,
          price,
          originalPrice: null,
          teacherName: r.teacherName,
          isFree: price === 0,
        });
      }
    }

    if (wantType("bundle")) {
      let q = db
        .selectFrom("courseBundles")
        .innerJoin("users", "users.id", "courseBundles.teacherId")
        .select([
          "courseBundles.id",
          "courseBundles.title",
          "courseBundles.slug",
          "courseBundles.thumbnailUrl",
          "courseBundles.price",
          "courseBundles.originalPrice",
          "users.displayName as teacherName",
        ])
        .where("courseBundles.isPublished", "=", true);
      if (searchPattern) {
        q = q.where("courseBundles.title", "ilike", searchPattern);
      }
      const rows = await q.orderBy("courseBundles.createdAt", "desc").limit(perTypeLimit).execute();
      for (const r of rows) {
        const price = parseFloat(r.price as unknown as string);
        const originalPrice = r.originalPrice ? parseFloat(r.originalPrice as unknown as string) : null;
        items.push({
          type: "bundle",
          id: r.id,
          title: r.title,
          slug: r.slug,
          thumbnailUrl: r.thumbnailUrl,
          price,
          originalPrice: originalPrice != null && originalPrice > price ? originalPrice : null,
          teacherName: r.teacherName,
          isFree: price === 0,
        });
      }
    }

    return new Response(superjson.stringify({ items } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}
