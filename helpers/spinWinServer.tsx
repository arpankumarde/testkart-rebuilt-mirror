import { randomInt } from "crypto";
import { customAlphabet } from "nanoid";
import { sql, type Kysely, type Selectable, type Transaction } from "kysely";
import { db } from "./db";
import { jsonbParam } from "./jsonbParam";
import type { DB, SpinCampaigns, SpinCampaignRewards, SpinRecords } from "./schema";
import {
  computeSpinDiscount,
  couponPrefixFor,
  toMilli,
  type SpinCheckoutLine,
  type SpinCouponTerms,
  type SpinDiscountType,
} from "./spinWinRules";

type Executor = Kysely<DB> | Transaction<DB>;
type Campaign = Selectable<SpinCampaigns>;
type Reward = Selectable<SpinCampaignRewards>;
type SpinRecord = Selectable<SpinRecords>;

/** Errors a student may see as-is. */
export class SpinWinError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "SpinWinError";
  }
}

export const GUEST_COOKIE = "tk_spin_guest";

export function readGuestSessionId(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === GUEST_COOKIE) {
      const value = rest.join("=");
      return /^[A-Za-z0-9_-]{20,64}$/.test(value) ? value : null;
    }
  }
  return null;
}

/** Kept until the campaign's coupons expire, so a guest's one spin survives closing the browser. */
export function guestCookieHeader(id: string, expiresAt: Date): string {
  return `${GUEST_COOKIE}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/_api/spin-win; Expires=${expiresAt.toUTCString()}`;
}

export const newGuestSessionId = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 32);

const codeSuffix = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 8);

export type RewardSnapshot = {
  name: string;
  rewardType: string;
  wheelLabel: string;
  discountType: SpinDiscountType | null;
  discountValue: number | null;
  minOrderValue: number | null;
  maxDiscountAmount: number | null;
  probability: number;
};

const num = (value: string | number | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

function snapshotOf(reward: Reward): RewardSnapshot {
  return {
    name: reward.name,
    rewardType: reward.rewardType,
    wheelLabel: reward.wheelLabel,
    discountType: (reward.discountType as SpinDiscountType | null) ?? null,
    discountValue: num(reward.discountValue),
    minOrderValue: num(reward.minOrderValue),
    maxDiscountAmount: num(reward.maxDiscountAmount),
    probability: Number(reward.probability),
  };
}

export const couponExpiry = (campaign: Pick<Campaign, "redemptionDeadline" | "endsAt">): Date =>
  new Date(campaign.redemptionDeadline ?? campaign.endsAt);

export const claimDeadline = (campaign: Pick<Campaign, "claimDeadline" | "endsAt">): Date =>
  new Date(campaign.claimDeadline ?? campaign.endsAt);

export async function writeSpinAudit(
  executor: Executor,
  entry: {
    campaignId: number | null;
    adminId: number | null;
    entity: "campaign" | "reward" | "coupon";
    entityId: number | string | null;
    action: string;
    before?: unknown;
    after?: unknown;
  }
) {
  await executor
    .insertInto("spinCampaignAuditLogs")
    .values({
      campaignId: entry.campaignId,
      adminId: entry.adminId,
      entity: entry.entity,
      entityId: entry.entityId === null ? null : String(entry.entityId),
      action: entry.action,
      before: entry.before === undefined ? null : jsonbParam(entry.before),
      after: entry.after === undefined ? null : jsonbParam(entry.after),
    })
    .execute();
}

/**
 * Rewards a spin can land on right now: on, above 0%, past their activation time and not out of
 * stock. When some are excluded the rest keep their relative odds, so every spin still wins.
 */
async function availableRewards(trx: Transaction<DB>, campaignId: number, exclude: Set<number>): Promise<Reward[]> {
  const now = new Date();
  const rewards = await trx
    .selectFrom("spinCampaignRewards")
    .selectAll()
    .where("campaignId", "=", campaignId)
    .where("isActive", "=", true)
    .execute();
  const limited = rewards.filter((r) => r.quantityLimit !== null).map((r) => r.id);
  const used = new Map<number, number>();
  if (limited.length > 0) {
    const rows = await trx
      .selectFrom("spinRecords")
      .select(["rewardId", (eb) => eb.fn.countAll<string>().as("n")])
      .where("rewardId", "in", limited)
      .groupBy("rewardId")
      .execute();
    for (const row of rows) used.set(row.rewardId, Number(row.n));
  }
  return rewards.filter(
    (r) =>
      !exclude.has(r.id) &&
      toMilli(r.probability) > 0 &&
      (r.activatesAt === null || new Date(r.activatesAt) <= now) &&
      (r.quantityLimit === null || (used.get(r.id) ?? 0) < r.quantityLimit)
  );
}

function pickWeighted(rewards: Reward[]): Reward {
  const total = rewards.reduce((sum, r) => sum + toMilli(r.probability), 0);
  let ticket = randomInt(0, total);
  for (const reward of rewards) {
    ticket -= toMilli(reward.probability);
    if (ticket < 0) return reward;
  }
  return rewards[rewards.length - 1];
}

async function chooseReward(trx: Transaction<DB>, campaignId: number): Promise<Reward> {
  const exclude = new Set<number>();
  for (let attempt = 0; attempt < 10; attempt++) {
    const pool = await availableRewards(trx, campaignId, exclude);
    if (pool.length === 0) throw new SpinWinError("No rewards are available right now. Please try again later.", 409);
    const reward = pickWeighted(pool);
    if (reward.quantityLimit === null) return reward;
    // Stock is re-checked under the reward's row lock so parallel spins cannot overrun it.
    await trx.selectFrom("spinCampaignRewards").select("id").where("id", "=", reward.id).forUpdate().execute();
    const taken = await trx
      .selectFrom("spinRecords")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("rewardId", "=", reward.id)
      .executeTakeFirstOrThrow();
    if (Number(taken.n) < reward.quantityLimit) return reward;
    exclude.add(reward.id);
  }
  throw new SpinWinError("No rewards are available right now. Please try again later.", 409);
}

export async function findSpin(
  executor: Executor,
  campaignId: number,
  by: { userId: number } | { guestSessionId: string }
): Promise<SpinRecord | undefined> {
  let query = executor.selectFrom("spinRecords").selectAll().where("campaignId", "=", campaignId);
  query = "userId" in by ? query.where("userId", "=", by.userId) : query.where("guestSessionId", "=", by.guestSessionId);
  return query.executeTakeFirst();
}

/**
 * Records one spin. The reward is chosen and stored before the client animates anything. The
 * partial unique indexes on (campaign, user) and (campaign, guest session) make a second spin
 * impossible even under parallel requests; the loser of a race gets the winner's row back.
 */
export async function recordSpin(
  campaign: Campaign,
  viewer: { userId: number } | { guestSessionId: string }
): Promise<{ spin: SpinRecord; created: boolean }> {
  return db.transaction().execute(async (trx) => {
    if (campaign.maxTotalSpins !== null) {
      await trx.selectFrom("spinCampaigns").select("id").where("id", "=", campaign.id).forUpdate().execute();
      const spun = await trx
        .selectFrom("spinRecords")
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .where("campaignId", "=", campaign.id)
        .executeTakeFirstOrThrow();
      if (Number(spun.n) >= campaign.maxTotalSpins) {
        throw new SpinWinError("All spins for this campaign have been used.", 409);
      }
    }

    const reward = await chooseReward(trx, campaign.id);
    const inserted = await trx
      .insertInto("spinRecords")
      .values({
        campaignId: campaign.id,
        rewardId: reward.id,
        userId: "userId" in viewer ? viewer.userId : null,
        guestSessionId: "guestSessionId" in viewer ? viewer.guestSessionId : null,
        spunAs: "userId" in viewer ? "user" : "guest",
        rewardSnapshot: jsonbParam(snapshotOf(reward)),
      })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();

    if (inserted) return { spin: inserted, created: true };
    const existing = await findSpin(trx, campaign.id, viewer);
    if (!existing) throw new SpinWinError("Your spin could not be recorded. Please try again.", 409);
    return { spin: existing, created: false };
  });
}

export type ClaimOutcome =
  | { kind: "claimed"; spin: SpinRecord; couponId: number | null }
  | { kind: "forfeited"; message: string };

async function issueCoupon(
  trx: Transaction<DB>,
  campaign: Campaign,
  spin: SpinRecord,
  userId: number,
  snapshot: RewardSnapshot
): Promise<number> {
  const expiresAt = couponExpiry(campaign);
  const prefix = couponPrefixFor(campaign) + "-";
  const discountType = snapshot.discountType as SpinDiscountType;
  let promo: { id: number } | undefined;
  for (let attempt = 0; attempt < 6 && !promo; attempt++) {
    promo = await trx
      .insertInto("promoCodes")
      .values({
        code: prefix + codeSuffix(),
        description: `Spin & Win: ${campaign.name} - ${snapshot.name}`,
        discountType: discountType === "flat" ? "fixed" : "percentage",
        discountValue: String(snapshot.discountValue),
        appliesTo: "all",
        targetItemIds: null,
        minPurchaseAmount: snapshot.minOrderValue !== null ? String(snapshot.minOrderValue) : null,
        maxDiscountAmount: snapshot.maxDiscountAmount !== null ? String(snapshot.maxDiscountAmount) : null,
        usageLimit: 1,
        perUserLimit: 1,
        validFrom: new Date(),
        validUntil: expiresAt,
        isActive: true,
        isPublic: false,
        createdByTeacherId: null,
        createdByAdminId: null,
      })
      .onConflict((oc) => oc.column("code").doNothing())
      .returning("id")
      .executeTakeFirst();
  }
  if (!promo) throw new SpinWinError("Your coupon could not be created. Please try again.", 500);

  const coupon = await trx
    .insertInto("spinCoupons")
    .values({
      campaignId: campaign.id,
      rewardId: spin.rewardId,
      spinRecordId: spin.id,
      promoCodeId: promo.id,
      userId,
      discountType,
      discountValue: String(snapshot.discountValue),
      minOrderValue: String(snapshot.minOrderValue ?? 0),
      maxDiscountAmount: snapshot.maxDiscountAmount !== null ? String(snapshot.maxDiscountAmount) : null,
      maxDiscountPercent: String(campaign.maxDiscountPercent),
      eligibleCategories: campaign.eligibleCategories,
      expiresAt,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return coupon.id;
}

/**
 * Attaches a spin to a student and issues its coupon. Idempotent: claiming again returns the same
 * coupon. A guest spin claimed by an account that already spun is forfeited, never stacked.
 */
export async function claimSpin(campaign: Campaign, spinId: string, userId: number): Promise<ClaimOutcome> {
  return db.transaction().execute(async (trx) => {
    const spin = await trx.selectFrom("spinRecords").selectAll().where("id", "=", spinId).forUpdate().executeTakeFirst();
    if (!spin || spin.campaignId !== campaign.id) throw new SpinWinError("Spin not found.", 404);

    if (spin.claimStatus === "claimed") {
      if (spin.userId !== userId) throw new SpinWinError("This reward has already been claimed by another account.", 409);
      const coupon = await trx.selectFrom("spinCoupons").select("id").where("spinRecordId", "=", spin.id).executeTakeFirst();
      return { kind: "claimed", spin, couponId: coupon?.id ?? null };
    }
    if (spin.claimStatus === "forfeited") {
      throw new SpinWinError("This reward can no longer be claimed.", 409);
    }
    if (new Date() > claimDeadline(campaign)) {
      throw new SpinWinError("The claim window for this campaign has closed.", 409);
    }

    if (spin.userId === null) {
      const accountSpin = await findSpin(trx, campaign.id, { userId });
      if (accountSpin) {
        await trx
          .updateTable("spinRecords")
          .set({ claimStatus: "forfeited", forfeitedByUserId: userId, forfeitReason: "account_already_spun" })
          .where("id", "=", spin.id)
          .execute();
        return {
          kind: "forfeited",
          message: "This account has already used its spin for this campaign, so this reward cannot be added to it.",
        };
      }
    } else if (spin.userId !== userId) {
      throw new SpinWinError("This spin belongs to another account.", 403);
    }

    const claimed = await trx
      .updateTable("spinRecords")
      .set({ userId, claimStatus: "claimed", claimedAt: new Date() })
      .where("id", "=", spin.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    const snapshot = spin.rewardSnapshot as unknown as RewardSnapshot;
    const couponId = snapshot.discountType ? await issueCoupon(trx, campaign, claimed, userId, snapshot) : null;
    return { kind: "claimed", spin: claimed, couponId };
  });
}

export type SpinCouponRule = SpinCouponTerms & {
  couponId: number;
  promoCodeId: number;
  campaignId: number;
  rewardId: number;
  code: string;
};

/**
 * Called by every checkout path right after it loads a promo code. Returns null for ordinary
 * codes. For a spin coupon it locks the coupon row (so two checkouts cannot both spend it) and
 * throws unless the signed-in student owns it and it is live and unspent.
 *
 * Checkout paths cancel the student's own pending orders first, so a pending order found here is
 * a payment really in flight. The cart preview passes ignorePending: starting checkout will cancel
 * that pending order and release the coupon, so it must not read as spent there.
 */
export async function getSpinCouponRuleOrThrow(
  executor: Executor,
  promoCodeId: number,
  userId: number,
  options: { ignorePending?: boolean } = {}
): Promise<SpinCouponRule | null> {
  const coupon = await executor
    .selectFrom("spinCoupons as sc")
    .innerJoin("promoCodes as pc", "pc.id", "sc.promoCodeId")
    .selectAll("sc")
    .select("pc.code")
    .where("sc.promoCodeId", "=", promoCodeId)
    .forUpdate()
    .executeTakeFirst();
  if (!coupon) return null;
  if (coupon.userId !== userId) throw new Error("This coupon belongs to another account.");
  if (coupon.voidedAt) throw new Error("This coupon has been withdrawn.");
  if (new Date(coupon.expiresAt) < new Date()) throw new Error("This coupon has expired.");
  const spent = await executor
    .selectFrom("promoCodeUsages")
    .innerJoin("orders", "orders.id", "promoCodeUsages.orderId")
    .select("orders.id")
    .where("promoCodeUsages.promoCodeId", "=", promoCodeId)
    .where("orders.status", "in", options.ignorePending ? ["completed", "refunded"] : ["pending", "completed", "refunded"])
    .executeTakeFirst();
  if (spent) throw new Error("This coupon has already been used.");
  return {
    couponId: coupon.id,
    promoCodeId,
    campaignId: coupon.campaignId,
    rewardId: coupon.rewardId,
    code: coupon.code,
    discountType: coupon.discountType as SpinDiscountType,
    discountValue: Number(coupon.discountValue),
    minOrderValue: Number(coupon.minOrderValue),
    maxDiscountAmount: num(coupon.maxDiscountAmount),
    maxDiscountPercent: Number(coupon.maxDiscountPercent),
    eligibleCategories: coupon.eligibleCategories,
  };
}

export function applySpinCouponOrThrow(rule: SpinCouponRule, lines: SpinCheckoutLine[]) {
  const result = computeSpinDiscount(rule, lines);
  if (!result.ok) throw new Error(result.message);
  return { ...result, rule, originalTotal: Math.round(lines.reduce((sum, l) => sum + l.price, 0) * 100) / 100 };
}

export type AppliedSpinCoupon = ReturnType<typeof applySpinCouponOrThrow>;

/**
 * The order-level record of a spin coupon going into an order, written in the same transaction
 * as the order. Its lifecycle follows the order: pending is payment pending, completed is
 * redeemed, failed or cancelled releases the coupon. PayU callbacks only move pending orders, so
 * repeated callbacks cannot redeem twice.
 */
export async function recordSpinRedemption(
  trx: Transaction<DB>,
  applied: AppliedSpinCoupon,
  order: { id: number; userId: number; finalAmount: number; paymentMethod: string }
) {
  await trx
    .insertInto("spinCouponRedemptions")
    .values({
      orderId: order.id,
      couponId: applied.rule.couponId,
      promoCodeId: applied.rule.promoCodeId,
      campaignId: applied.rule.campaignId,
      rewardId: applied.rule.rewardId,
      userId: order.userId,
      couponCode: applied.rule.code,
      discountType: applied.rule.discountType,
      discountValue: String(applied.rule.discountValue),
      originalTotal: applied.originalTotal.toFixed(2),
      eligibleAmount: applied.eligibleAmount.toFixed(2),
      discountAmount: applied.discount.toFixed(2),
      finalAmount: order.finalAmount.toFixed(2),
      paymentMethod: order.paymentMethod,
    })
    .execute();
}

type CartRow = {
  mockTestId: number | null;
  courseId: number | null;
  digitalProductId: number | null;
  testPrice?: string | number | null;
  testDiscountPrice?: string | number | null;
  coursePrice?: string | number | null;
  digitalProductPrice?: string | number | null;
};

/** Cart rows as checkout lines, priced the way the checkout endpoints price them. */
export function spinCartLines(cartItems: CartRow[]): SpinCheckoutLine[] {
  return cartItems.flatMap((item): SpinCheckoutLine[] => {
    if (item.mockTestId) return [{ type: "test", id: item.mockTestId, price: Number(item.testDiscountPrice ?? item.testPrice ?? 0) }];
    if (item.courseId) return [{ type: "course", id: item.courseId, price: Number(item.coursePrice ?? 0) }];
    if (item.digitalProductId) return [{ type: "digitalProduct", id: item.digitalProductId, price: Number(item.digitalProductPrice ?? 0) }];
    return [];
  });
}

export const asEligibleItemIds = (lines: SpinCheckoutLine[]) =>
  lines.flatMap((line) =>
    line.type === "test" || line.type === "course" || line.type === "digitalProduct" ? [{ type: line.type, id: line.id }] : []
  );

export async function isSpinCouponPromo(executor: Executor, promoCodeId: number): Promise<boolean> {
  const row = await executor.selectFrom("spinCoupons").select("id").where("promoCodeId", "=", promoCodeId).executeTakeFirst();
  return !!row;
}

/** Coupon status from its usage: void, redeemed (paid or later refunded), in checkout, expired, else active. */
export const spinCouponStatusSql = sql<string>`(CASE
  WHEN sc.voided_at IS NOT NULL THEN 'void'
  WHEN EXISTS (SELECT 1 FROM promo_code_usages u JOIN orders o ON o.id = u.order_id
               WHERE u.promo_code_id = sc.promo_code_id AND o.status IN ('completed', 'refunded')) THEN 'redeemed'
  WHEN EXISTS (SELECT 1 FROM promo_code_usages u JOIN orders o ON o.id = u.order_id
               WHERE u.promo_code_id = sc.promo_code_id AND o.status = 'pending') THEN 'reserved'
  WHEN sc.expires_at < now() THEN 'expired'
  ELSE 'active' END)`;
