import { createHash } from "crypto";

/**
 * Whether a user sits in the autopilot's global holdout: a fixed share of
 * users who never get an autopilot message, so its effect can be measured
 * against them. Deterministic per user and salt; the salt in the rev_autopilot
 * setting must never change after launch, or every user is reshuffled.
 * Server-only (node crypto).
 */
export function isInGlobalHoldout(userId: number, salt: string, percent: number): boolean {
  if (!salt || !(percent > 0)) return false;
  if (percent >= 100) return true;
  const digest = createHash("sha256").update(`${salt}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100 < percent;
}