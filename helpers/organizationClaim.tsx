/**
 * Shared helpers for the "claim an auto-imported organisation" flow.
 *
 * Trust model: a teacher never gets to type an arbitrary email/phone and have
 * us believe them. We only ever send the OTP to a contact value that was
 * already scraped onto the organisation's own listing (its Google Maps phone
 * number, or one of the emails found on its own website) - so successfully
 * entering the code proves they have access to the business's own inbox or
 * phone, not just that they typed a number.
 */

export const CLAIM_OTP_EXPIRATION_MINUTES = 10;
export const CLAIM_MAX_VERIFY_ATTEMPTS = 5;

/** "rohan@swellinstitute.com" -> "ro***@swellinstitute.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 2))}@${domain}`;
}

/** "+919716452767" -> "+91 97*****767" (keeps country code, first 2 and last 3 digits) */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "*".repeat(digits.length);
  const country = digits.length > 10 ? digits.slice(0, digits.length - 10) : "";
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  const head = local.slice(0, 2);
  const tail = local.slice(-3);
  const masked = `${head}${"*".repeat(Math.max(local.length - 5, 0))}${tail}`;
  return country ? `+${country} ${masked}` : masked;
}

export function parseContactEmails(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}
