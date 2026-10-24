import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { runAdminSpin } from "../../../helpers/spinWinAdmin";
import { couponColumns, couponOrderIdSql, couponsQuery, couponStatusOrNull, csvCell, spinColumns, spinsQuery } from "../../../helpers/spinWinAdminQueries";
import { addDays, dayStart } from "../../../helpers/spinWinAnalytics";
import { spinCouponStatusSql, type RewardSnapshot } from "../../../helpers/spinWinServer";
import { schema } from "./export_GET.schema";

const MAX_ROWS = 50000;

const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

export async function handle(request: Request) {
  return runAdminSpin(request, async () => {
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    let csv: string;

    if (input.kind === "spins") {
      const rows = await spinsQuery(input)
        .select([...spinColumns, couponStatusOrNull.as("couponStatus")])
        .orderBy("s.spunAt", "asc")
        .limit(MAX_ROWS)
        .execute();
      csv = toCsv(
        ["Spin ID", "Campaign", "User ID", "Student", "Email", "Mobile", "Spun as", "Session ref", "Spun at", "Reward", "Claim status", "Claimed at", "Coupon", "Coupon status"],
        rows.map((r) => [
          String(r.id),
          r.campaignName,
          r.userId,
          r.studentName,
          r.studentEmail,
          r.studentMobile,
          r.spunAs,
          r.guestSessionId?.slice(0, 8) ?? null,
          r.spunAt,
          (r.rewardSnapshot as unknown as RewardSnapshot).name,
          r.claimStatus,
          r.claimedAt,
          r.couponCode,
          r.couponStatus,
        ])
      );
    } else if (input.kind === "coupons") {
      const rows = await couponsQuery(input)
        .select([...couponColumns, spinCouponStatusSql.as("status"), couponOrderIdSql.as("orderId")])
        .orderBy("sc.issuedAt", "asc")
        .limit(MAX_ROWS)
        .execute();
      csv = toCsv(
        ["Code", "Campaign", "User ID", "Student", "Email", "Reward", "Discount type", "Discount value", "Min order", "Max discount", "Status", "Issued at", "Expires at", "Order ID"],
        rows.map((r) => [
          r.code,
          r.campaignName,
          r.userId,
          r.studentName,
          r.studentEmail,
          r.rewardName,
          r.discountType,
          r.discountValue,
          r.minOrderValue,
          r.maxDiscountAmount,
          r.status,
          r.issuedAt,
          r.expiresAt,
          r.orderId,
        ])
      );
    } else {
      // One row per completed order that used a spin coupon, with the commission maths per order.
      const rows = await sql<Record<string, unknown>>`
        SELECT o.id AS order_id, o.created_at, c.name AS campaign_name, pc.code, r.name AS reward_name, r.reward_type,
          o.user_id, u.display_name AS student_name,
          sum(oi.price_at_purchase) AS original_value,
          sum(oi.discount_amount) AS discount,
          o.total_amount AS paid,
          sum(oi.price_at_purchase * oi.platform_fee_percentage / 100) AS commission_on_original,
          sum((oi.price_at_purchase - oi.discount_amount) * oi.platform_fee_percentage / 100) AS commission_on_paid,
          sum((oi.price_at_purchase - oi.discount_amount) * (1 - oi.platform_fee_percentage / 100)) AS teacher_payout_current,
          sum(oi.price_at_purchase * (1 - oi.platform_fee_percentage / 100)) AS teacher_payout_proposed
        FROM spin_coupons sc
        JOIN promo_codes pc ON pc.id = sc.promo_code_id
        JOIN spin_campaigns c ON c.id = sc.campaign_id
        JOIN spin_campaign_rewards r ON r.id = sc.reward_id
        JOIN promo_code_usages pu ON pu.promo_code_id = sc.promo_code_id
        JOIN orders o ON o.id = pu.order_id AND o.status = 'completed'
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN users u ON u.id = o.user_id
        WHERE true
          ${input.campaignId ? sql`AND sc.campaign_id = ${input.campaignId}` : sql``}
          ${input.from ? sql`AND o.created_at >= ${dayStart(input.from)}` : sql``}
          ${input.to ? sql`AND o.created_at < ${dayStart(addDays(input.to, 1))}` : sql``}
        GROUP BY o.id, c.name, pc.code, r.name, r.reward_type, u.display_name
        ORDER BY o.created_at
        LIMIT ${MAX_ROWS}
      `.execute(db);
      csv = toCsv(
        [
          "Order ID", "Ordered at", "Campaign", "Coupon", "Reward", "Reward type", "User ID", "Student",
          "Original value", "Discount", "Student paid", "Commission on original", "Commission on paid (current)",
          "Teacher payout (current)", "Teacher payout (proposed)", "Testkart margin (current)", "Testkart margin (proposed)",
        ],
        rows.rows.map((r) => {
          const money = (v: unknown) => Number(v ?? 0).toFixed(2);
          return [
            r.orderId, r.createdAt, r.campaignName, r.code, r.rewardName, r.rewardType, r.userId, r.studentName,
            money(r.originalValue), money(r.discount), money(r.paid), money(r.commissionOnOriginal), money(r.commissionOnPaid),
            money(r.teacherPayoutCurrent), money(r.teacherPayoutProposed), money(r.commissionOnPaid),
            money(Number(r.commissionOnOriginal ?? 0) - Number(r.discount ?? 0)),
          ];
        })
      );
    }

    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="spin-win-${input.kind}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}