import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow, ForbiddenError, NotAuthenticatedError } from "../../../helpers/getAdminSession";
import { courseEffectivePrice } from "../../../helpers/coursePricing";
import { permittedPriceHistoryTypes, type PriceHistoryProductType } from "../../../helpers/productPriceHistory";
import { PRICE_HISTORY_COLUMNS, priceHistoryRows, toPriceHistoryEntry } from "../../../helpers/productPriceHistoryQuery";
import { schema, OutputType, PriceHistoryProductSnapshot } from "./product_GET.schema";

const amount = (value: string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

type Snapshot = Omit<PriceHistoryProductSnapshot, "exists" | "teacherName">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* The product as it stands now, priced by the same rule the history triggers use. */
async function loadSnapshot(type: PriceHistoryProductType, productId: string): Promise<Snapshot | undefined> {
  if (type === "live_course") {
    if (!UUID.test(productId)) return undefined;
    const row = await db.selectFrom("liveCourses").select(["title", "status", "teacherId", "price", "originalPrice"]).where("id", "=", productId).executeTakeFirst();
    return row && { title: row.title, status: row.status, teacherId: row.teacherId, currentPrice: Number(row.price), currentListPrice: amount(row.originalPrice) };
  }
  if (!/^\d{1,9}$/.test(productId)) return undefined;
  const id = Number(productId);
  switch (type) {
    case "digital_product": {
      const row = await db.selectFrom("digitalProducts").select(["title", "status", "teacherId", "price", "discountPrice"]).where("id", "=", id).executeTakeFirst();
      return row && { title: row.title, status: row.status ?? null, teacherId: row.teacherId, currentPrice: courseEffectivePrice(row.price, row.discountPrice), currentListPrice: Number(row.price) };
    }
    case "course": {
      const row = await db.selectFrom("courses").select(["title", "status", "teacherId", "price", "discountPrice"]).where("id", "=", id).executeTakeFirst();
      return row && { title: row.title, status: row.status, teacherId: row.teacherId, currentPrice: courseEffectivePrice(row.price, row.discountPrice), currentListPrice: Number(row.price) };
    }
    case "mock_test": {
      const row = await db.selectFrom("mockTests").select(["title", "isPublished", "deletedAt", "teacherId", "price", "discountPrice"]).where("id", "=", id).executeTakeFirst();
      return row && {
        title: row.title,
        status: row.deletedAt ? "in trash" : row.isPublished ? "published" : "draft",
        teacherId: row.teacherId,
        currentPrice: Number(row.discountPrice ?? row.price),
        currentListPrice: Number(row.price),
      };
    }
    case "live_test": {
      const row = await db.selectFrom("liveTests").select(["title", "isActive", "teacherId", "price", "discountPrice"]).where("id", "=", id).executeTakeFirst();
      return row && {
        title: row.title,
        status: row.isActive ? "active" : "inactive",
        teacherId: row.teacherId,
        currentPrice: Number(row.discountPrice ?? row.price),
        currentListPrice: Number(row.price),
      };
    }
    case "course_bundle": {
      const row = await db.selectFrom("courseBundles").select(["title", "isPublished", "teacherId", "price"]).where("id", "=", id).executeTakeFirst();
      return row && { title: row.title, status: row.isPublished ? "published" : "unpublished", teacherId: row.teacherId, currentPrice: Number(row.price), currentListPrice: null };
    }
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (!permittedPriceHistoryTypes(admin.permissions).includes(input.productType)) {
      return new Response(
        superjson.stringify({ error: "Your admin account does not have access to this product type's price history." }),
        { status: 403 }
      );
    }

    const rows = await priceHistoryRows(db)
      .where("h.productType", "=", input.productType)
      .where("h.productId", "=", input.productId)
      .select(PRICE_HISTORY_COLUMNS)
      .orderBy("h.changedAt", "desc")
      .orderBy("h.id", "desc")
      .limit(500)
      .execute();
    const entries = rows.map(toPriceHistoryEntry);

    const snapshot = await loadSnapshot(input.productType, input.productId);
    const teacherId = snapshot?.teacherId ?? entries[0]?.teacherId ?? null;
    const teacher =
      teacherId === null
        ? undefined
        : await db.selectFrom("users").select(["displayName", "email"]).where("id", "=", teacherId).executeTakeFirst();

    const output: OutputType = {
      product: {
        exists: !!snapshot,
        title: snapshot?.title ?? entries[0]?.productTitle ?? null,
        status: snapshot?.status ?? null,
        teacherId,
        teacherName: teacher ? teacher.displayName || teacher.email : teacherId !== null ? `Teacher #${teacherId}` : null,
        currentPrice: snapshot?.currentPrice ?? null,
        currentListPrice: snapshot?.currentListPrice ?? null,
      },
      entries,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 403 });
    }
    console.error("Error fetching product price history:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}