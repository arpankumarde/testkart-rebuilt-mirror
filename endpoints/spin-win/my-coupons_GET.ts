import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import type { OutputType } from "./my-coupons_GET.schema";
import { spinCouponStatusSql, SpinWinError } from "../../helpers/spinWinServer";
import { couponOrderIdSql } from "../../helpers/spinWinAdminQueries";
import type { SpinCouponStatus } from "../../helpers/spinWinRules";
import { readSpinViewer, spinErrorResponse, transferGuestSpins } from "../../helpers/spinWinViewer";

export async function handle(request: Request) {
  try {
    const viewer = await readSpinViewer(request);
    if (viewer.userId === null) throw new SpinWinError("Not authenticated", 401);
    // A reward won as a guest in this browser is linked to the account before the list is read.
    await transferGuestSpins(request, viewer);

    const rows = await db
      .selectFrom("spinCoupons as sc")
      .innerJoin("promoCodes as pc", "pc.id", "sc.promoCodeId")
      .innerJoin("spinCampaigns as c", "c.id", "sc.campaignId")
      .innerJoin("spinCampaignRewards as r", "r.id", "sc.rewardId")
      .select([
        "sc.id",
        "pc.code",
        "c.name as campaignName",
        "c.slug as campaignSlug",
        "r.name as rewardName",
        "sc.discountType",
        "sc.discountValue",
        "sc.minOrderValue",
        "sc.maxDiscountAmount",
        "sc.maxDiscountPercent",
        "sc.eligibleCategories",
        "sc.issuedAt",
        "sc.expiresAt",
        spinCouponStatusSql.as("status"),
        couponOrderIdSql.as("orderId"),
        sql<string | null>`(SELECT u.discount_amount FROM promo_code_usages u JOIN orders o ON o.id = u.order_id
          WHERE u.promo_code_id = sc.promo_code_id AND o.status IN ('completed', 'refunded') ORDER BY o.created_at DESC LIMIT 1)`.as(
          "savedAmount"
        ),
      ])
      .where("sc.userId", "=", viewer.userId)
      .orderBy("sc.issuedAt", "desc")
      .execute();

    const output: OutputType = {
      coupons: rows.map((row) => ({
        ...row,
        discountType: row.discountType as "percentage" | "flat",
        discountValue: Number(row.discountValue),
        minOrderValue: Number(row.minOrderValue),
        maxDiscountAmount: row.maxDiscountAmount === null ? null : Number(row.maxDiscountAmount),
        maxDiscountPercent: Number(row.maxDiscountPercent),
        status: row.status as SpinCouponStatus,
        orderId: row.orderId === null ? null : Number(row.orderId),
        savedAmount: row.savedAmount === null ? null : Number(row.savedAmount),
      })),
    };
    return new Response(superjson.stringify(output), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return spinErrorResponse(error, "Failed to load your coupons");
  }
}