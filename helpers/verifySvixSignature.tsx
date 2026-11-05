import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies a Svix-signed webhook (Resend uses Svix): the signature is a
 * base64 HMAC-SHA256 of "<svix-id>.<svix-timestamp>.<raw body>", keyed on the
 * base64 part of the whsec_ secret. The header may carry several
 * space-separated "v1,<sig>" entries; any match passes. Timestamps outside the
 * tolerance are refused so a captured request cannot be replayed later.
 * Server-only (node crypto).
 */
export function verifySvixSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const { secret, id, timestamp, signatureHeader, body } = input;
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const sentAt = Number(timestamp);
  if (!Number.isInteger(sentAt)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - sentAt) > (input.toleranceSeconds ?? 300)) return false;

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  for (const entry of signatureHeader.split(" ")) {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) continue;
    const given = Buffer.from(signature, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}