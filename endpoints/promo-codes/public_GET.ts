import { db } from "../../helpers/db";
import { schema, OutputType } from "./public_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";
import { PromoItemType, promoCodeAppliesToItem } from "../../helpers/promoCodeEligibility";

const MAX_COUPONS = 5;

async function getItemTeacherId(itemType: PromoItemType, itemId: number): Promise<number | null> {
  switch (itemType) {
    case "course": {
      const row = await db.selectFrom("courses").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "test": {
      const row = await db.selectFrom("mockTests").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "live_test": {
      const row = await db.selectFrom("liveTests").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "bundle": {
      const row = await db.selectFrom("courseBundles").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
    case "digital_product": {
      const row = await db.selectFrom("digitalProducts").select("teacherId").where("id", "=", itemId).executeTakeFirst();
      return row?.teacherId ?? null;
    }
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { itemType, itemId } = schema.parse({
      itemType: url.searchParams.get("itemType"),
      itemId: url.searchParams.get("itemId"),
    });

    const teacherId = await getItemTeacherId(itemType, itemId);
    if (teacherId === null) {
      return new Response(superjson.stringify({ promoCodes: [] } satisfies OutputType), { status: 200 });
    }

    const now = new Date();
    const rows = await db
      .selectFrom("promoCodes")
      .selectAll()
      .where("createdByTeacherId", "=", teacherId)
      .where("isPublic", "=", true)
      .where("isActive", "=", true)
      .where("validFrom", "<=", now)
      .where((eb) => eb.or([eb("validUntil", "is", null), eb("validUntil", ">", now)]))
      .orderBy("createdAt", "desc")
      .execute();

    const promoCodes = rows
      .filter((row) => row.usageLimit === null || row.usageCount < row.usageLimit)
      .filter((row) => promoCodeAppliesToItem(row, itemType, itemId))
      .slice(0, MAX_COUPONS)
      .map((row) => ({
        id: row.id,
        code: row.code,
        discountType: row.discountType,
        discountValue: parseFloat(row.discountValue),
        minPurchaseAmount: row.minPurchaseAmount === null ? null : parseFloat(row.minPurchaseAmount),
        maxDiscountAmount: row.maxDiscountAmount === null ? null : parseFloat(row.maxDiscountAmount),
        validUntil: row.validUntil,
      }));

    return new Response(superjson.stringify({ promoCodes } satisfies OutputType), { status: 200 });
  } catch (error) {
    console.error("Failed to list public promo codes:", error);
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Invalid input" }), { status: 400 });
    }
    return new Response(superjson.stringify({ error: "Failed to load coupons" }), { status: 500 });
  }
}
