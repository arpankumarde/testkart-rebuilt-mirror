/**
 * Converts a string into a URL-friendly slug.
 *
 * This function performs the following transformations:
 * - Converts the string to lowercase.
 * - Replaces one or more spaces with a single hyphen.
 * - Removes all characters that are not alphanumeric or a hyphen.
 * - Collapses multiple consecutive hyphens into a single hyphen.
 * - Trims any leading or trailing hyphens.
 *
 * @param text The input string to convert.
 * @returns A URL-friendly slug.
 *
 * @example
 * slugify("SSC Exams") // "ssc-exams"
 * slugify("  State Bank of India PO!!  ") // "state-bank-of-india-po"
 * slugify("---Test---With---Hyphens---") // "test-with-hyphens"
 */
export const slugify = (text: string): string => {
  if (!text) {
    return "";
  }

  const slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars except -
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text

  return slug;
};