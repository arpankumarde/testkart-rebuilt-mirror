/**
 * Normalizes a phone number to 10-digit format without country code.
 * Accepts formats like:
 * - "7078352004" (10 digits)
 * - "+917078352004" (12 digits with +91)
 * - "917078352004" (12 digits with 91)
 * 
 * Returns: "7078352004" (10 digits only)
 * Throws error if the phone number cannot be normalized to 10 digits.
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // If 10 digits, return as-is
  if (digits.length === 10) {
    return digits;
  }
  
  // If 12 digits and starts with 91, return the last 10 digits
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  
  // If we got here, we couldn't normalize properly
  throw new Error(`Invalid phone number format: ${phone}. Expected 10 digits or +91XXXXXXXXXX format.`);
}

/**
 * Sanitizes mobile number input by removing non-digits, stripping the 91 prefix if present
 * and limiting to 10 digits. Safe for use in onChange handlers as it doesn't throw.
 */
export function sanitizeMobileInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  
  // If it has more than 10 digits and starts with 91, strip the 91 prefix
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  
  // Return at most 10 digits
  return digits.slice(0, 10);
}