import { createHash, randomBytes } from "crypto";

/* Server only. The raw token is shown to the admin once; the database keeps its sha256. */

export function createLoginLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLoginLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const LOGIN_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;