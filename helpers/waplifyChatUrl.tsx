const WAPLIFY_CHAT_BASE = "https://app.waplify.io/chat";

/** Browser-safe link to a contact's Waplify chat (91XXXXXXXXXX, no +); null when the number is not a valid Indian mobile. */
export function buildWaplifyChatUrl(mobileNumber: string | null | undefined): string | null {
  if (!mobileNumber) return null;
  let digits = mobileNumber.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `${WAPLIFY_CHAT_BASE}/91${digits}` : null;
}
