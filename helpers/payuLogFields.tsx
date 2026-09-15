// PayU payloads also carry the customer's name, email, phone, address, name on card, masked card number, card hash
// and bank reference, so logs get an allowlist. The callback posts the error code as `error`, the Verify Payment API
// returns it as `error_code`.
const LOGGED_FIELDS = ["txnid", "status", "unmappedstatus", "error_code", "error", "mihpayid"] as const;

export function payuLogFields(fields: Record<string, unknown> | null | undefined): Record<string, string> {
  const picked: Record<string, string> = {};
  if (!fields) return picked;
  for (const key of LOGGED_FIELDS) {
    const value = fields[key];
    if (typeof value === "string" || typeof value === "number") picked[key] = String(value);
  }
  return picked;
}