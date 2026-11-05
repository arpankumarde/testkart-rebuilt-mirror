import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies a Waplify webhook: X-Webhook-Signature is "sha256=" plus the hex
 * HMAC-SHA256 of the raw request body, keyed on the endpoint's signing secret
 * (waplify-BE app/modules/webhooks/services.py). Server-only (node crypto).
 */
export function verifyWaplifySignature(secret: string, body: string, header: string | null): boolean {
  if (!secret || !header) return false;
  const given = header.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest();
  const actual = Buffer.from(given, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}