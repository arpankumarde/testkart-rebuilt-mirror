import { sql, type RawBuilder } from "kysely";
import { db } from "./db";

/**
 * Campaign metrics for the Spin & Win admin. Days are IST calendar days. A redemption is a
 * completed order that used a spin coupon; refunded orders drop out of revenue and redemptions.
 *
 * Finance shows two treatments side by side. "Current" is what settlement does today
 * (helpers/teacherEarningsSql): teacher earnings = (price - discount) * (1 - fee), so the
 * discount is shared pro rata. "Proposed" is the PRD model awaiting finance approval: the
 * teacher keeps price * (1 - fee) and Testkart's commission absorbs the whole discount.
 * Nothing here changes settlement.
 */

export type SpinRange = { startDay: string; endDay: string };

export type SpinStats = {
  totalSpins: number;
  uniqueParticipants: number;
  userSpins: number;
  guestSpins: number;
  claimed: number;
  unclaimed: number;
  forfeited: number;
  couponsGenerated: number;
  couponsRedeemed: number;
  orders: number;
  revenue: number;
  discount: number;
  firstTimeBuyers: number;
  repeatBuyers: number;
};

export type SpinFinance = {
  originalValue: number;
  discount: number;
  studentPaid: number;
  commissionOnOriginal: number;
  commissionOnPaid: number;
  teacherPayoutCurrent: number;
  teacherPayoutProposed: number;
  marginCurrent: number;
  marginProposed: number;
};

export type SpinDailyPoint = {
  day: string;
  spins: number;
  userSpins: number;
  guestSpins: number;
  coupons: number;
  redemptions: number;
  revenue: number;
  discount: number;
};

export type SpinRewardRow = {
  rewardId: number;
  campaignId: number;
  name: string;
  rewardType: string;
  segmentColor: string;
  spins: number;
  claimed: number;
  coupons: number;
  redeemed: number;
  discount: number;
  revenue: number;
};

export type SpinTypeCost = { rewardType: string; redemptions: number; discount: number };

const IST = "Asia/Kolkata";

export const dayStart = (day: string): Date => new Date(`${day}T00:00:00+05:30`);

export function istToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function istDay(date: Date): string {
  return istToday(date);
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const n = (value: unknown): number => Number(value ?? 0);

function scope(campaignId: number | null, range: SpinRange | null) {
  const start = range ? dayStart(range.startDay) : null;
  const end = range ? dayStart(addDays(range.endDay, 1)) : null;
  const campaign = (column: string): RawBuilder<unknown> =>
    campaignId === null ? sql`` : sql`AND ${sql.ref(column)} = ${campaignId}`;
  const window = (column: string): RawBuilder<unknown> =>
    start && end ? sql`AND ${sql.ref(column)} >= ${start} AND ${sql.ref(column)} < ${end}` : sql``;
  return sql`
    s AS (
      SELECT sr.* FROM spin_records sr WHERE true ${campaign("sr.campaign_id")} ${window("sr.spun_at")}
    ),
    c AS (
      SELECT sc.* FROM spin_coupons sc WHERE true ${campaign("sc.campaign_id")} ${window("sc.issued_at")}
    ),
    red AS (
      SELECT DISTINCT ON (o.id)
        o.id AS order_id, o.user_id, o.total_amount, o.discount_amount, o.created_at,
        sc.id AS coupon_id, sc.reward_id, sc.campaign_id
      FROM spin_coupons sc
      JOIN promo_code_usages u ON u.promo_code_id = sc.promo_code_id
      JOIN orders o ON o.id = u.order_id
      WHERE o.status = 'completed' ${campaign("sc.campaign_id")} ${window("o.created_at")}
    )`;
}

export async function loadSpinStats(campaignId: number | null, range: SpinRange | null): Promise<SpinStats> {
  const result = await sql<Record<string, unknown>>`
    WITH ${scope(campaignId, range)}
    SELECT
      (SELECT count(*) FROM s) AS total_spins,
      (SELECT count(DISTINCT coalesce('u' || user_id::text, 'g' || guest_session_id)) FROM s) AS unique_participants,
      (SELECT count(*) FROM s WHERE spun_as = 'user') AS user_spins,
      (SELECT count(*) FROM s WHERE spun_as = 'guest') AS guest_spins,
      (SELECT count(*) FROM s WHERE claim_status = 'claimed') AS claimed,
      (SELECT count(*) FROM s WHERE claim_status = 'unclaimed') AS unclaimed,
      (SELECT count(*) FROM s WHERE claim_status = 'forfeited') AS forfeited,
      (SELECT count(*) FROM c) AS coupons_generated,
      (SELECT count(DISTINCT coupon_id) FROM red) AS coupons_redeemed,
      (SELECT count(*) FROM red) AS orders,
      (SELECT coalesce(sum(total_amount), 0) FROM red) AS revenue,
      (SELECT coalesce(sum(discount_amount), 0) FROM red) AS discount,
      (SELECT count(*) FROM red WHERE NOT EXISTS (
        SELECT 1 FROM orders o2 WHERE o2.user_id = red.user_id AND o2.status = 'completed' AND o2.created_at < red.created_at
      )) AS first_time_buyers,
      (SELECT count(DISTINCT red.user_id) FROM red WHERE EXISTS (
        SELECT 1 FROM orders o3 WHERE o3.user_id = red.user_id AND o3.status = 'completed' AND o3.created_at > red.created_at
      )) AS repeat_buyers
  `.execute(db);
  const row = result.rows[0] ?? {};
  return {
    totalSpins: n(row.totalSpins),
    uniqueParticipants: n(row.uniqueParticipants),
    userSpins: n(row.userSpins),
    guestSpins: n(row.guestSpins),
    claimed: n(row.claimed),
    unclaimed: n(row.unclaimed),
    forfeited: n(row.forfeited),
    couponsGenerated: n(row.couponsGenerated),
    couponsRedeemed: n(row.couponsRedeemed),
    orders: n(row.orders),
    revenue: n(row.revenue),
    discount: n(row.discount),
    firstTimeBuyers: n(row.firstTimeBuyers),
    repeatBuyers: n(row.repeatBuyers),
  };
}

export async function loadSpinFinance(campaignId: number | null, range: SpinRange | null): Promise<SpinFinance> {
  const result = await sql<Record<string, unknown>>`
    WITH ${scope(campaignId, range)}
    SELECT
      coalesce(sum(oi.price_at_purchase), 0) AS original_value,
      coalesce(sum(oi.discount_amount), 0) AS discount,
      coalesce(sum(oi.price_at_purchase * oi.platform_fee_percentage / 100), 0) AS commission_on_original,
      coalesce(sum((oi.price_at_purchase - oi.discount_amount) * oi.platform_fee_percentage / 100), 0) AS commission_on_paid,
      coalesce(sum((oi.price_at_purchase - oi.discount_amount) * (1 - oi.platform_fee_percentage / 100)), 0) AS teacher_payout_current,
      coalesce(sum(oi.price_at_purchase * (1 - oi.platform_fee_percentage / 100)), 0) AS teacher_payout_proposed
    FROM red JOIN order_items oi ON oi.order_id = red.order_id
  `.execute(db);
  const row = result.rows[0] ?? {};
  const originalValue = n(row.originalValue);
  const discount = n(row.discount);
  const commissionOnOriginal = n(row.commissionOnOriginal);
  const commissionOnPaid = n(row.commissionOnPaid);
  return {
    originalValue,
    discount,
    studentPaid: originalValue - discount,
    commissionOnOriginal,
    commissionOnPaid,
    teacherPayoutCurrent: n(row.teacherPayoutCurrent),
    teacherPayoutProposed: n(row.teacherPayoutProposed),
    marginCurrent: commissionOnPaid,
    marginProposed: commissionOnOriginal - discount,
  };
}

export async function loadSpinDaily(campaignId: number | null, range: SpinRange): Promise<SpinDailyPoint[]> {
  const tz = sql.lit(IST);
  const result = await sql<Record<string, unknown>>`
    WITH ${scope(campaignId, range)}
    SELECT to_char(d, 'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM s WHERE (s.spun_at AT TIME ZONE ${tz})::date = d::date) AS spins,
      (SELECT count(*) FROM s WHERE s.spun_as = 'user' AND (s.spun_at AT TIME ZONE ${tz})::date = d::date) AS user_spins,
      (SELECT count(*) FROM s WHERE s.spun_as = 'guest' AND (s.spun_at AT TIME ZONE ${tz})::date = d::date) AS guest_spins,
      (SELECT count(*) FROM c WHERE (c.issued_at AT TIME ZONE ${tz})::date = d::date) AS coupons,
      (SELECT count(*) FROM red WHERE (red.created_at AT TIME ZONE ${tz})::date = d::date) AS redemptions,
      (SELECT coalesce(sum(total_amount), 0) FROM red WHERE (red.created_at AT TIME ZONE ${tz})::date = d::date) AS revenue,
      (SELECT coalesce(sum(discount_amount), 0) FROM red WHERE (red.created_at AT TIME ZONE ${tz})::date = d::date) AS discount
    FROM generate_series(${range.startDay}::date, ${range.endDay}::date, interval '1 day') d
    ORDER BY d
  `.execute(db);
  return result.rows.map((row) => ({
    day: String(row.day),
    spins: n(row.spins),
    userSpins: n(row.userSpins),
    guestSpins: n(row.guestSpins),
    coupons: n(row.coupons),
    redemptions: n(row.redemptions),
    revenue: n(row.revenue),
    discount: n(row.discount),
  }));
}

export async function loadSpinRewardRows(campaignId: number | null, range: SpinRange | null): Promise<SpinRewardRow[]> {
  const result = await sql<Record<string, unknown>>`
    WITH ${scope(campaignId, range)}
    SELECT r.id AS reward_id, r.campaign_id, r.name, r.reward_type, r.segment_color,
      (SELECT count(*) FROM s WHERE s.reward_id = r.id) AS spins,
      (SELECT count(*) FROM s WHERE s.reward_id = r.id AND s.claim_status = 'claimed') AS claimed,
      (SELECT count(*) FROM c WHERE c.reward_id = r.id) AS coupons,
      (SELECT count(*) FROM red WHERE red.reward_id = r.id) AS redeemed,
      (SELECT coalesce(sum(discount_amount), 0) FROM red WHERE red.reward_id = r.id) AS discount,
      (SELECT coalesce(sum(total_amount), 0) FROM red WHERE red.reward_id = r.id) AS revenue
    FROM spin_campaign_rewards r
    WHERE ${campaignId === null ? sql`true` : sql`r.campaign_id = ${campaignId}`}
    ORDER BY r.campaign_id, r.sort_order, r.id
  `.execute(db);
  return result.rows.map((row) => ({
    rewardId: n(row.rewardId),
    campaignId: n(row.campaignId),
    name: String(row.name),
    rewardType: String(row.rewardType),
    segmentColor: String(row.segmentColor),
    spins: n(row.spins),
    claimed: n(row.claimed),
    coupons: n(row.coupons),
    redeemed: n(row.redeemed),
    discount: n(row.discount),
    revenue: n(row.revenue),
  }));
}

export function costByRewardType(rows: SpinRewardRow[]): SpinTypeCost[] {
  const byType = new Map<string, SpinTypeCost>();
  for (const row of rows) {
    const entry = byType.get(row.rewardType) ?? { rewardType: row.rewardType, redemptions: 0, discount: 0 };
    entry.redemptions += row.redeemed;
    entry.discount += row.discount;
    byType.set(row.rewardType, entry);
  }
  return [...byType.values()];
}

/**
 * The analytics window: the requested IST days, else the campaign's own days up to today, else
 * the last 30 days. Clamped to 180 days so the daily series stays one cheap query.
 */
export function resolveRange(
  input: { from?: string | null; to?: string | null },
  campaign: { startsAt: Date; endsAt: Date } | null
): SpinRange {
  const today = istToday();
  let endDay = input.to ?? (campaign ? minDay(istDay(new Date(campaign.endsAt)), today) : today);
  let startDay = input.from ?? (campaign ? istDay(new Date(campaign.startsAt)) : addDays(endDay, -29));
  if (startDay > endDay) [startDay, endDay] = [endDay, startDay];
  if (dayStart(endDay).getTime() - dayStart(startDay).getTime() > 179 * 86400000) startDay = addDays(endDay, -179);
  return { startDay, endDay };
}

const minDay = (a: string, b: string) => (a < b ? a : b);
