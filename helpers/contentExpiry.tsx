import { z } from "zod";
import type { ContentType, ContentVisibility } from "./schema";

/*
 * Product expiry, shared by the server and every teacher and admin screen.
 *
 * A teacher picks the last day an item stays on sale, as an IST calendar date.
 * It is stored as expiresAt, the instant it comes off sale: 00:00 IST the next
 * day. 15 Nov 2026 is on sale all of 15 Nov and expires at 16 Nov 00:00 IST.
 *
 * At that instant purchase, cart and enrolment paths refuse the item
 * (helpers/contentExpiryServer). The contentExpirySweep job then unlists it by
 * setting visibility to unlisted, so every discovery query that already filters
 * on visibility = "public" drops it, and records expiredAt plus the visibility
 * it had. Buyers keep their access. Nothing relists an expired item except the
 * teacher's or an admin's explicit Relist, which restores that visibility.
 */

export const EXPIRING_SOON_DAYS = 7;

/** The table behind each content type; every one carries expires_at, expired_at and pre_expiry_visibility. */
export const CONTENT_TABLES: Record<ContentType, string> = {
  mock_test: "mock_tests",
  live_test: "live_tests",
  course: "courses",
  digital_product: "digital_products",
  course_bundle: "course_bundles",
};

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRY_HELP = "This product will automatically be unlisted after the selected expiry date.";

/** The last day on sale, as YYYY-MM-DD in IST. */
export const expiryDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Pick a valid date");

/** The IST calendar date (YYYY-MM-DD) an instant falls on. */
export const istDay = (instant: Date): string => new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export const todayIst = (now: Date = new Date()): string => istDay(now);

/** Last day on sale to the instant it comes off sale: 00:00 IST on the following day. */
export const expiryCutoff = (lastDay: string): Date => {
  const [y, m, d] = lastDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1) - IST_OFFSET_MS);
};

/** The instant an item comes off sale back to its last day on sale. */
export const expiryLastDay = (cutoff: Date): string => istDay(new Date(cutoff.getTime() - 1));

/** "15 Nov 2026" for a YYYY-MM-DD day. */
export const formatExpiryDay = (day: string): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

/** "16 Nov 2026, 12:00 am" in IST, for the moment an item was unlisted. */
export const formatExpiryMoment = (instant: Date): string =>
  instant.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

export type ExpiryFields = {
  expiresAt: Date | null;
  expiredAt: Date | null;
};

/** Past its expiry, whether or not the sweep has unlisted it yet. */
export const isPastExpiry = (expiresAt: Date | null | undefined, now: Date = new Date()): boolean =>
  !!expiresAt && expiresAt.getTime() <= now.getTime();

export const isExpired = (item: ExpiryFields, now: Date = new Date()): boolean =>
  item.expiredAt !== null || isPastExpiry(item.expiresAt, now);

export const isExpiringSoon = (item: ExpiryFields, now: Date = new Date()): boolean =>
  !isExpired(item, now) && !!item.expiresAt && item.expiresAt.getTime() - now.getTime() <= EXPIRING_SOON_DAYS * DAY_MS;

/*
 * The listing status teacher and admin screens show. Expired always wins: an
 * expired item is unlisted underneath, and Unlisted means a teacher chose it.
 */
export type ListingStatus = "draft" | "active" | "expiring_soon" | "expired" | "unlisted";

export const listingStatus = (
  item: ExpiryFields & { live: boolean; visibility: ContentVisibility },
  now: Date = new Date()
): ListingStatus => {
  if (isExpired(item, now)) return "expired";
  if (!item.live) return "draft";
  if (item.visibility === "unlisted") return "unlisted";
  return isExpiringSoon(item, now) ? "expiring_soon" : "active";
};

export const LISTING_STATUS_META: Record<
  ListingStatus,
  { label: string; variant: "outline" | "warning" | "destructive" | "success" | "lavender"; hint: string }
> = {
  draft: { label: "Draft", variant: "outline", hint: "Not published yet." },
  active: { label: "Active", variant: "success", hint: "Listed and on sale." },
  expiring_soon: {
    label: "Expiring soon",
    variant: "warning",
    hint: `Listed and on sale. It expires within ${EXPIRING_SOON_DAYS} days.`,
  },
  expired: {
    label: "Expired",
    variant: "destructive",
    hint: "Its expiry date has passed, so it was unlisted automatically. Buyers keep their access.",
  },
  unlisted: { label: "Unlisted", variant: "lavender", hint: "Unlisted by the teacher. Open from its link only." },
};

export const expiredPurchaseMessage = (title?: string | null): string =>
  title
    ? `"${title}" has expired and is no longer available for purchase.`
    : "This product has expired and is no longer available for purchase.";

export const expiredCartMessage = (titles: string[]): string => {
  const list = titles.map((t) => `"${t}"`).join(", ");
  return titles.length === 1
    ? `${list} has expired and is no longer available for purchase. Remove it from your cart to continue.`
    : `${list} have expired and are no longer available for purchase. Remove them from your cart to continue.`;
};

/** The admin module that governs each content type's expiry. */
export const EXPIRY_ADMIN_MODULE: Record<ContentType, "test_series" | "courses" | "notes" | "live_tests" | "bundles"> = {
  mock_test: "test_series",
  course: "courses",
  digital_product: "notes",
  live_test: "live_tests",
  course_bundle: "bundles",
};
