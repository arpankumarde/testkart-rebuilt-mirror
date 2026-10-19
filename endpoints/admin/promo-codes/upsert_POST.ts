import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./upsert_POST.schema";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const normalizedCode = input.code.trim().toUpperCase();

    const existingWithCode = await db
      .selectFrom("promoCodes")
      .select("id")
      .where("code", "=", normalizedCode)
      .executeTakeFirst();
    if (existingWithCode && existingWithCode.id !== input.id) {
      throw new Error("A promo code with this code already exists.");
    }

    const values = {
      code: normalizedCode,
      description: input.description || null,
      discountType: input.discountType,
      discountValue: String(input.discountValue),
      maxDiscountAmount: input.maxDiscountAmount != null ? String(input.maxDiscountAmount) : null,
      appliesTo: "subscription" as const,
      recurringScope: input.recurringScope,
      targetItemIds: input.planIds && input.planIds.length > 0 ? input.planIds : null,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      validUntil: input.validUntil ?? null,
      isActive: input.isActive,
      isPublic: false,
      createdByTeacherId: null,
    };

    let result: OutputType;
    if (input.id) {
      result = await db
        .updateTable("promoCodes")
        .set({ ...values, updatedAt: new Date() })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      result = await db
        .insertInto("promoCodes")
        .values({ ...values, createdByAdminId: admin.id })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to save promo code" }),
      { status: 400 }
    );
  }
}
