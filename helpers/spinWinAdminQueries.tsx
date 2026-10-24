import { sql } from "kysely";
import { db } from "./db";
import { spinCouponStatusSql } from "./spinWinServer";
import { addDays, dayStart } from "./spinWinAnalytics";
import type { SpinCouponStatus } from "./spinWinRules";

/** Shared list queries for the Spin & Win admin tables and their CSV exports. */

export type SpinListFilters = {
  campaignId?: number;
  search?: string;
  from?: string;
  to?: string;
};

export const couponStatusOrNull = sql<string | null>`(CASE WHEN sc.id IS NULL THEN NULL ELSE ${spinCouponStatusSql} END)`;

const like = (search: string) => `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export function spinsQuery(filters: SpinListFilters & { claimStatus?: string; spunAs?: string }) {
  let query = db
    .selectFrom("spinRecords as s")
    .innerJoin("spinCampaigns as c", "c.id", "s.campaignId")
    .leftJoin("users as u", "u.id", "s.userId")
    .leftJoin("spinCoupons as sc", "sc.spinRecordId", "s.id")
    .leftJoin("promoCodes as pc", "pc.id", "sc.promoCodeId");
  if (filters.campaignId) query = query.where("s.campaignId", "=", filters.campaignId);
  if (filters.claimStatus) query = query.where("s.claimStatus", "=", filters.claimStatus);
  if (filters.spunAs) query = query.where("s.spunAs", "=", filters.spunAs);
  if (filters.from) query = query.where("s.spunAt", ">=", dayStart(filters.from));
  if (filters.to) query = query.where("s.spunAt", "<", dayStart(addDays(filters.to, 1)));
  if (filters.search) {
    const search = filters.search;
    const pattern = like(search);
    query = query.where((eb) =>
      eb.or([
        eb("u.displayName", "ilike", pattern),
        eb("u.email", "ilike", pattern),
        eb("u.mobileNumber", "ilike", pattern),
        eb("pc.code", "ilike", pattern),
        eb("s.guestSessionId", "ilike", pattern),
        ...(/^\d+$/.test(search) ? [eb("s.userId", "=", Number(search))] : []),
      ])
    );
  }
  return query;
}

export const spinColumns = [
  "s.id",
  "s.campaignId",
  "c.name as campaignName",
  "s.userId",
  "u.displayName as studentName",
  "u.email as studentEmail",
  "u.mobileNumber as studentMobile",
  "s.spunAs",
  "s.guestSessionId",
  "s.spunAt",
  "s.rewardSnapshot",
  "s.claimStatus",
  "s.claimedAt",
  "s.forfeitReason",
  "s.forfeitedByUserId",
  "pc.code as couponCode",
] as const;

export function couponsQuery(filters: SpinListFilters & { status?: SpinCouponStatus }) {
  let query = db
    .selectFrom("spinCoupons as sc")
    .innerJoin("promoCodes as pc", "pc.id", "sc.promoCodeId")
    .innerJoin("spinCampaigns as c", "c.id", "sc.campaignId")
    .innerJoin("spinCampaignRewards as r", "r.id", "sc.rewardId")
    .leftJoin("users as u", "u.id", "sc.userId");
  if (filters.campaignId) query = query.where("sc.campaignId", "=", filters.campaignId);
  if (filters.status) query = query.where(spinCouponStatusSql, "=", filters.status);
  if (filters.from) query = query.where("sc.issuedAt", ">=", dayStart(filters.from));
  if (filters.to) query = query.where("sc.issuedAt", "<", dayStart(addDays(filters.to, 1)));
  if (filters.search) {
    const pattern = like(filters.search);
    query = query.where((eb) =>
      eb.or([eb("pc.code", "ilike", pattern), eb("u.displayName", "ilike", pattern), eb("u.email", "ilike", pattern), eb("u.mobileNumber", "ilike", pattern)])
    );
  }
  return query;
}

/** The order a coupon went into: its paid order if any, else the one in checkout. */
export const couponOrderIdSql = sql<number | null>`(SELECT o.id FROM promo_code_usages u2 JOIN orders o ON o.id = u2.order_id
  WHERE u2.promo_code_id = sc.promo_code_id AND o.status IN ('completed', 'refunded', 'pending')
  ORDER BY (o.status = 'completed') DESC, o.created_at DESC LIMIT 1)`;

export const couponColumns = [
  "sc.id",
  "pc.code",
  "sc.userId",
  "u.displayName as studentName",
  "u.email as studentEmail",
  "u.mobileNumber as studentMobile",
  "r.name as rewardName",
  "r.rewardType",
  "sc.discountType",
  "sc.discountValue",
  "sc.minOrderValue",
  "sc.maxDiscountAmount",
  "sc.campaignId",
  "c.name as campaignName",
  "sc.issuedAt",
  "sc.expiresAt",
] as const;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Leading = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}