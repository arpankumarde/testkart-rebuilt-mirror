import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { runAdminSpin } from "../../../helpers/spinWinAdmin";
import { couponColumns, couponOrderIdSql, couponsQuery } from "../../../helpers/spinWinAdminQueries";
import { spinCouponStatusSql } from "../../../helpers/spinWinServer";
import type { SpinCouponStatus } from "../../../helpers/spinWinRules";
import { schema, type OutputType } from "./coupon_GET.schema";

export async function handle(request: Request) {
  return runAdminSpin(request, async () => {
    const { id } = schema.parse({ id: new URL(request.url).searchParams.get("id") });
    const row = await couponsQuery({})
      .innerJoin("spinRecords as s", "s.id", "sc.spinRecordId")
      .leftJoin("admins as a", "a.id", "sc.voidedByAdminId")
      .select([
        ...couponColumns,
        spinCouponStatusSql.as("status"),
        couponOrderIdSql.as("orderId"),
        "sc.eligibleCategories",
        "sc.maxDiscountPercent",
        "sc.promoCodeId",
        "s.spunAs",
        "s.spunAt",
        "s.claimedAt",
        "sc.voidedAt",
        "sc.voidedReason",
        "a.fullName as voidedByName",
      ])
      .where("sc.id", "=", id)
      .executeTakeFirst();
    if (!row) throw new Error("Coupon not found.");

    const usages = await db
      .selectFrom("promoCodeUsages as u")
      .innerJoin("orders as o", "o.id", "u.orderId")
      .select([
        "o.id as orderId",
        "o.status as orderStatus",
        "o.totalAmount",
        "o.discountAmount",
        "o.createdAt",
        sql<string>`(SELECT coalesce(sum(oi.price_at_purchase), 0) FROM order_items oi WHERE oi.order_id = o.id)`.as("originalAmount"),
      ])
      .where("u.promoCodeId", "=", row.promoCodeId)
      .orderBy("o.createdAt", "desc")
      .execute();

    const { promoCodeId: _promoCodeId, ...coupon } = row;
    const output: OutputType = {
      coupon: {
        ...coupon,
        discountType: coupon.discountType as "percentage" | "flat",
        discountValue: Number(coupon.discountValue),
        minOrderValue: Number(coupon.minOrderValue),
        maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
        maxDiscountPercent: Number(coupon.maxDiscountPercent),
        status: coupon.status as SpinCouponStatus,
        orderId: coupon.orderId === null ? null : Number(coupon.orderId),
      },
      usages: usages.map((u) => ({
        orderId: u.orderId,
        orderStatus: u.orderStatus,
        originalAmount: Number(u.originalAmount),
        discountAmount: Number(u.discountAmount),
        paidAmount: Number(u.totalAmount),
        createdAt: u.createdAt as Date,
      })),
    };
    return output;
  });
}