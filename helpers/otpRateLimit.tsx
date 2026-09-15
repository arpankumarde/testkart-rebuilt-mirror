import { Kysely } from "kysely";
import { DB } from "./schema";

/**
 * Shared abuse-prevention for the OTP send endpoints. Every allowed call here
 * results in a real, billed SMS via MSG91 or a real email, so these limits
 * exist to stop OTP-pumping abuse (scripts spraying many recipients, or
 * repeatedly re-requesting the same one) rather than just being a UX nicety.
 *
 * checkOtpRateLimit (SMS: mobile-login, mobile-signup, auth/send_otp) enforces:
 *  - per mobile number: a short cooldown between sends, plus hourly/daily caps
 *  - per user, when the caller is signed in: hourly/daily caps, since a
 *    signed-in caller can rotate numbers and the IP axis trusts a forwarded header
 *  - per source IP: hourly/daily caps, since a single attacker typically
 *    rotates through many numbers from one machine/script
 *
 * checkEmailOtpRateLimit (auth/send-email-otp) enforces the same cooldown and
 * caps per address and per user.
 *
 * IP checks are skipped (not fail-open in a way that disables everything --
 * only the IP axis) when no IP could be determined, since we never want a
 * missing header to lock out every legitimate user.
 */

const COOLDOWN_SECONDS = 45;
const MAX_PER_NUMBER_PER_HOUR = 5;
const MAX_PER_NUMBER_PER_DAY = 8;
const MAX_PER_IP_PER_HOUR = 8;
const MAX_PER_IP_PER_DAY = 20;
const MAX_PER_USER_PER_HOUR = 5;
const MAX_PER_USER_PER_DAY = 10;
const MAX_PER_EMAIL_PER_HOUR = 5;
const MAX_PER_EMAIL_PER_DAY = 8;

export interface OtpRateLimitParams {
  mobileNumber: string;
  ipAddress: string | null;
  userId?: number;
}

export interface EmailOtpRateLimitParams {
  email: string;
  userId: number;
}

export type OtpRateLimitResult =
  | { allowed: true }
  | { allowed: false; message: string };

export async function checkOtpRateLimit(
  db: Kysely<DB>,
  { mobileNumber, ipAddress, userId }: OtpRateLimitParams
): Promise<OtpRateLimitResult> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Cooldown - the most recent send to this number, regardless of window.
  const lastForNumber = await db
    .selectFrom("mobileOtps")
    .select("createdAt")
    .where("mobileNumber", "=", mobileNumber)
    .orderBy("createdAt", "desc")
    .executeTakeFirst();

  if (lastForNumber) {
    const secondsSinceLast =
      (now.getTime() - new Date(lastForNumber.createdAt).getTime()) / 1000;
    if (secondsSinceLast < COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(COOLDOWN_SECONDS - secondsSinceLast);
      return {
        allowed: false,
        message: `Please wait ${waitSeconds} second${waitSeconds === 1 ? "" : "s"} before requesting another OTP.`,
      };
    }
  }

  // 2. Per-number hourly / daily caps.
  const numberCounts = await db
    .selectFrom("mobileOtps")
    .select((eb) => [
      eb.fn
        .count<string>("id")
        .filterWhere("createdAt", ">=", oneHourAgo)
        .as("hourCount"),
      eb.fn
        .count<string>("id")
        .filterWhere("createdAt", ">=", oneDayAgo)
        .as("dayCount"),
    ])
    .where("mobileNumber", "=", mobileNumber)
    .executeTakeFirst();

  const numberHourCount = Number(numberCounts?.hourCount ?? 0);
  const numberDayCount = Number(numberCounts?.dayCount ?? 0);

  if (numberHourCount >= MAX_PER_NUMBER_PER_HOUR) {
    return {
      allowed: false,
      message: "Too many OTP requests for this number. Please try again in an hour.",
    };
  }

  if (numberDayCount >= MAX_PER_NUMBER_PER_DAY) {
    return {
      allowed: false,
      message: "Too many OTP requests for this number today. Please try again tomorrow.",
    };
  }

  // 3. Per-user hourly / daily caps (signed-in callers only).
  if (userId !== undefined) {
    const userCounts = await db
      .selectFrom("mobileOtps")
      .select((eb) => [
        eb.fn
          .count<string>("id")
          .filterWhere("createdAt", ">=", oneHourAgo)
          .as("hourCount"),
        eb.fn
          .count<string>("id")
          .filterWhere("createdAt", ">=", oneDayAgo)
          .as("dayCount"),
      ])
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (Number(userCounts?.hourCount ?? 0) >= MAX_PER_USER_PER_HOUR) {
      return {
        allowed: false,
        message: "Too many OTP requests from your account. Please try again in an hour.",
      };
    }

    if (Number(userCounts?.dayCount ?? 0) >= MAX_PER_USER_PER_DAY) {
      return {
        allowed: false,
        message: "Too many OTP requests from your account today. Please try again tomorrow.",
      };
    }
  }

  // 4. Per-IP hourly / daily caps (skipped entirely if IP is unknown).
  if (ipAddress) {
    const ipCounts = await db
      .selectFrom("mobileOtps")
      .select((eb) => [
        eb.fn
          .count<string>("id")
          .filterWhere("createdAt", ">=", oneHourAgo)
          .as("hourCount"),
        eb.fn
          .count<string>("id")
          .filterWhere("createdAt", ">=", oneDayAgo)
          .as("dayCount"),
      ])
      .where("ipAddress", "=", ipAddress)
      .executeTakeFirst();

    const ipHourCount = Number(ipCounts?.hourCount ?? 0);
    const ipDayCount = Number(ipCounts?.dayCount ?? 0);

    if (ipHourCount >= MAX_PER_IP_PER_HOUR) {
      return {
        allowed: false,
        message: "Too many OTP requests from your network. Please try again in an hour.",
      };
    }

    if (ipDayCount >= MAX_PER_IP_PER_DAY) {
      return {
        allowed: false,
        message: "Too many OTP requests from your network today. Please try again tomorrow.",
      };
    }
  }

  return { allowed: true };
}

export async function checkEmailOtpRateLimit(
  db: Kysely<DB>,
  { email, userId }: EmailOtpRateLimitParams
): Promise<OtpRateLimitResult> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Cooldown - the most recent send to this address, regardless of window.
  const lastForEmail = await db
    .selectFrom("emailOtps")
    .select("createdAt")
    .where("email", "=", email)
    .orderBy("createdAt", "desc")
    .executeTakeFirst();

  if (lastForEmail) {
    const secondsSinceLast =
      (now.getTime() - new Date(lastForEmail.createdAt).getTime()) / 1000;
    if (secondsSinceLast < COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(COOLDOWN_SECONDS - secondsSinceLast);
      return {
        allowed: false,
        message: `Please wait ${waitSeconds} second${waitSeconds === 1 ? "" : "s"} before requesting another code.`,
      };
    }
  }

  // 2. Per-address hourly / daily caps.
  const emailCounts = await db
    .selectFrom("emailOtps")
    .select((eb) => [
      eb.fn
        .count<string>("id")
        .filterWhere("createdAt", ">=", oneHourAgo)
        .as("hourCount"),
      eb.fn
        .count<string>("id")
        .filterWhere("createdAt", ">=", oneDayAgo)
        .as("dayCount"),
    ])
    .where("email", "=", email)
    .executeTakeFirst();

  if (Number(emailCounts?.hourCount ?? 0) >= MAX_PER_EMAIL_PER_HOUR) {
    return {
      allowed: false,
      message: "Too many verification emails to this address. Please try again in an hour.",
    };
  }

  if (Number(emailCounts?.dayCount ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
    return {
      allowed: false,
      message: "Too many verification emails to this address today. Please try again tomorrow.",
    };
  }

  // 3. Per-user hourly / daily caps.
  const userCounts = await db
    .selectFrom("emailOtps")
    .select((eb) => [
      eb.fn
        .count<string>("id")
        .filterWhere("createdAt", ">=", oneHourAgo)
        .as("hourCount"),
      eb.fn
        .count<string>("id")
        .filterWhere("createdAt", ">=", oneDayAgo)
        .as("dayCount"),
    ])
    .where("userId", "=", userId)
    .executeTakeFirst();

  if (Number(userCounts?.hourCount ?? 0) >= MAX_PER_USER_PER_HOUR) {
    return {
      allowed: false,
      message: "Too many verification emails from your account. Please try again in an hour.",
    };
  }

  if (Number(userCounts?.dayCount ?? 0) >= MAX_PER_USER_PER_DAY) {
    return {
      allowed: false,
      message: "Too many verification emails from your account today. Please try again tomorrow.",
    };
  }

  return { allowed: true };
}
