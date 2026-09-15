import { createHash } from "crypto";

/** Reset tokens are stored only as SHA-256 digests, so a leaked table row cannot be used as a link. */
export function hashAdminResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}