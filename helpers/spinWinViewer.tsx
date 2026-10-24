import superjson from "superjson";
import { sql, type Selectable } from "kysely";
import { db } from "./db";
import { getServerUserSession } from "./getServerUserSession";
import type { SpinCampaigns, SpinRecords } from "./schema";
import { getAdminServerSessionOrThrow } from "./getAdminSession";
import { claimSpin, couponExpiry, findSpin, readGuestSessionId, spinCouponStatusSql, SpinWinError, type RewardSnapshot } from "./spinWinServer";
import { spinCampaignPhase, type SpinCouponStatus } from "./spinWinRules";
import type { OutputType as CampaignView } from "../endpoints/spin-win/campaign_GET.schema";

export type SpinViewCoupon = {
  code: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderValue: number;
  maxDiscountAmount: number | null;
  eligibleCategories: string[];
  expiresAt: Date;
  status: SpinCouponStatus;
};

export type SpinViewState = {
  spinId: string;
  rewardId: number;
  /** Position on the wheel's active segments, or -1 when that reward has since been switched off. */
  wheelIndex: number;
  rewardName: string;
  wheelLabel: string;
  rewardType: string;
  /** The won terms, from the spin's snapshot, so a guest sees them before claiming. */
  discountType: "percentage" | "flat" | null;
  discountValue: number | null;
  minOrderValue: number | null;
  maxDiscountAmount: number | null;
  eligibleCategories: string[];
  /** When the coupon expires, or would expire once claimed. */
  expiresAt: Date;
  claimStatus: string;
  requiresLogin: boolean;
  coupon: SpinViewCoupon | null;
};

export type SpinViewer = { userId: number | null; role: string | null };

/**
 * The signed-in user, or a guest (role null). An admin session in the same browser, or an admin
 * signed in as a student, reads as that admin role. Never throws on a missing session.
 */
export async function readSpinViewer(request: Request): Promise<SpinViewer> {
  let viewer: SpinViewer = { userId: null, role: null };
  try {
    const { user, impersonatorAdminId } = await getServerUserSession(request);
    viewer = { userId: user.id, role: impersonatorAdminId != null ? "admin" : user.role };
  } catch {
    // Not signed in as a user.
  }
  if (isSpinEligible(viewer)) {
    try {
      const admin = await getAdminServerSessionOrThrow(request);
      viewer = { ...viewer, role: admin.role };
    } catch {
      // No admin session in this browser.
    }
  }
  return viewer;
}

/**
 * Moves this browser's unclaimed guest spins onto the signed-in student, so a reward won before
 * logging in or signing up reaches My Coupons however the student signed in. The spin is found
 * only through the HttpOnly guest cookie, never an id from the client. claimSpin locks the spin,
 * is idempotent, refuses a spin another account claimed and closes with the claim window, so
 * repeat calls never issue a second coupon. Never throws.
 */
export async function transferGuestSpins(request: Request, viewer: SpinViewer): Promise<void> {
  if (viewer.userId === null || viewer.role !== "student") return;
  const guestSessionId = readGuestSessionId(request);
  if (!guestSessionId) return;
  try {
    const pending = await db
      .selectFrom("spinRecords")
      .select(["id", "campaignId"])
      .where("guestSessionId", "=", guestSessionId)
      .where("claimStatus", "=", "unclaimed")
      .where("userId", "is", null)
      .execute();
    for (const spin of pending) {
      const campaign = await db.selectFrom("spinCampaigns").selectAll().where("id", "=", spin.campaignId).executeTakeFirst();
      if (!campaign) continue;
      try {
        await claimSpin(campaign, String(spin.id), viewer.userId);
      } catch (error) {
        if (!(error instanceof SpinWinError)) console.error("Guest spin transfer failed", error);
      }
    }
  } catch (error) {
    console.error("Guest spin transfer failed", error);
  }
}

/** Spin & Win is for students and logged-out visitors only; teachers and admins are refused. */
export const isSpinEligible = (viewer: SpinViewer) => viewer.role === null || viewer.role === "student";

export function assertSpinEligible(viewer: SpinViewer) {
  if (!isSpinEligible(viewer)) throw new SpinWinError("Spin & Win is for student accounts.", 403);
}

export async function loadCampaignBySlug(slug: string): Promise<Selectable<SpinCampaigns> | undefined> {
  return db.selectFrom("spinCampaigns").selectAll().where("slug", "=", slug).executeTakeFirst();
}

/** The published campaign running now; the latest start wins if two overlap. */
export async function loadActiveCampaign(): Promise<Selectable<SpinCampaigns> | undefined> {
  return db
    .selectFrom("spinCampaigns")
    .selectAll()
    .where("status", "=", "published")
    .where("startsAt", "<=", sql<Date>`now()`)
    .where("endsAt", ">", sql<Date>`now()`)
    .orderBy("startsAt", "desc")
    .executeTakeFirst();
}

export async function activeSegments(campaignId: number) {
  return db
    .selectFrom("spinCampaignRewards")
    .select(["id", "wheelLabel", "segmentColor", "icon", "probability", "rewardType", "discountType", "discountValue"])
    .where("campaignId", "=", campaignId)
    .where("isActive", "=", true)
    .orderBy("sortOrder", "asc")
    .orderBy("id", "asc")
    .execute();
}

export async function spinViewState(spin: Selectable<SpinRecords>, viewerUserId: number | null): Promise<SpinViewState> {
  const [segments, campaign] = await Promise.all([
    activeSegments(spin.campaignId),
    db.selectFrom("spinCampaigns").select(["redemptionDeadline", "endsAt", "eligibleCategories"]).where("id", "=", spin.campaignId).executeTakeFirstOrThrow(),
  ]);
  const snapshot = spin.rewardSnapshot as unknown as RewardSnapshot;
  let coupon: SpinViewCoupon | null = null;
  if (spin.claimStatus === "claimed" && spin.userId !== null && spin.userId === viewerUserId) {
    const row = await db
      .selectFrom("spinCoupons as sc")
      .innerJoin("promoCodes as pc", "pc.id", "sc.promoCodeId")
      .select([
        "pc.code",
        "sc.discountType",
        "sc.discountValue",
        "sc.minOrderValue",
        "sc.maxDiscountAmount",
        "sc.eligibleCategories",
        "sc.expiresAt",
        spinCouponStatusSql.as("status"),
      ])
      .where("sc.spinRecordId", "=", spin.id)
      .executeTakeFirst();
    if (row) {
      coupon = {
        code: row.code,
        discountType: row.discountType as "percentage" | "flat",
        discountValue: Number(row.discountValue),
        minOrderValue: Number(row.minOrderValue),
        maxDiscountAmount: row.maxDiscountAmount === null ? null : Number(row.maxDiscountAmount),
        eligibleCategories: row.eligibleCategories,
        expiresAt: row.expiresAt,
        status: row.status as SpinCouponStatus,
      };
    }
  }
  return {
    spinId: String(spin.id),
    rewardId: spin.rewardId,
    wheelIndex: segments.findIndex((s) => s.id === spin.rewardId),
    rewardName: snapshot.name,
    wheelLabel: snapshot.wheelLabel,
    rewardType: snapshot.rewardType,
    discountType: snapshot.discountType,
    discountValue: snapshot.discountValue,
    minOrderValue: snapshot.minOrderValue,
    maxDiscountAmount: snapshot.maxDiscountAmount,
    eligibleCategories: coupon?.eligibleCategories ?? campaign.eligibleCategories,
    expiresAt: coupon?.expiresAt ?? couponExpiry(campaign),
    claimStatus: spin.claimStatus,
    requiresLogin: spin.claimStatus === "unclaimed" && spin.userId === null,
    coupon,
  };
}

/**
 * What a visitor sees of a campaign: its public settings, the wheel, the real odds, and their own
 * spin. A signed-in student first gets this browser's unclaimed guest spin transferred; then their
 * own spin wins, otherwise this browser's guest spin, shown to a signed-in student only while it
 * is still unclaimed (a transfer that could not complete).
 */
export async function buildCampaignView(campaign: Selectable<SpinCampaigns>, request: Request, viewer: SpinViewer): Promise<CampaignView> {
  const phase = spinCampaignPhase(campaign);
  const guestSessionId = readGuestSessionId(request);
  await transferGuestSpins(request, viewer);

  let spin = viewer.userId !== null ? await findSpin(db, campaign.id, { userId: viewer.userId }) : undefined;
  if (!spin && guestSessionId) {
    const guestSpin = await findSpin(db, campaign.id, { guestSessionId });
    if (guestSpin && (viewer.userId === null || guestSpin.claimStatus === "unclaimed")) spin = guestSpin;
  }

  let reason: string | null = null;
  if (phase !== "active") reason = "This campaign is not live right now.";
  else if (!isSpinEligible(viewer)) reason = "Spin & Win is for student accounts.";
  else if (viewer.userId === null && (!campaign.allowGuestSpins || campaign.loginRequiredToSpin)) reason = "Log in to spin.";

  const segments = await activeSegments(campaign.id);
  return {
    campaign: {
      slug: campaign.slug,
      name: campaign.name,
      description: campaign.description,
      bannerUrl: campaign.bannerUrl,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      timezone: campaign.timezone,
      terms: campaign.terms,
      phase,
      allowGuestSpins: campaign.allowGuestSpins,
      loginRequiredToSpin: campaign.loginRequiredToSpin,
      eligibleCategories: campaign.eligibleCategories,
      couponExpiresAt: couponExpiry(campaign),
      maxDiscountPercent: Number(campaign.maxDiscountPercent),
      popupEnabled: campaign.popupEnabled,
      popupDelaySeconds: campaign.popupDelaySeconds,
    },
    segments: segments.map((s) => ({
      rewardId: s.id,
      label: s.wheelLabel,
      color: s.segmentColor,
      icon: s.icon,
      probability: Number(s.probability),
      discountType: (s.discountType as "percentage" | "flat" | null) ?? null,
      discountValue: s.discountValue === null ? null : Number(s.discountValue),
    })),
    viewer: {
      loggedIn: viewer.userId !== null,
      role: viewer.role,
      canSpin: !spin && reason === null,
      reason: spin ? null : reason,
      spin: spin ? await spinViewState(spin, viewer.userId) : null,
    },
  };
}

export function spinErrorResponse(error: unknown, fallback: string): Response {
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 400;
  const isUserFacing = error instanceof Error && error.name === "SpinWinError";
  if (!isUserFacing) console.error(fallback, error);
  return new Response(superjson.stringify({ error: isUserFacing ? (error as Error).message : fallback }), {
    status: isUserFacing ? status : 500,
  });
}
