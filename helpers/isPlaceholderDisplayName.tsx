/**
 * True when a display name is a system-generated placeholder rather than a name
 * the person actually chose.
 *
 * OTP login is the only path that invents one: both
 * endpoints/auth/mobile-login/verify-otp_POST.ts and its email twin set
 * `User_${id}`. Every other signup path takes a real name from the form or the
 * OAuth provider. "User 123" and "User Not Found" style names are treated the
 * same way, so a student cannot dodge the ask by swapping the underscore for a
 * space.
 *
 * "Userdrakes", "UserID" and "user2301" are names people picked and are left
 * alone: only "User" followed by an underscore or a space counts.
 */
import { containsEmoji, NAME_EMOJI_MESSAGE } from "./nameEmoji";

const PLACEHOLDER_PATTERN = /^user[_\s]/i;

/** The same rule as a Postgres regex, for matching stored names (e.g. reviews.reviewer_name). */
export const PLACEHOLDER_NAME_SQL_REGEX = "^\\s*user[_\\s]";

export const isPlaceholderDisplayName = (
  displayName: string | null | undefined
): boolean => {
  if (!displayName) return true;
  return PLACEHOLDER_PATTERN.test(displayName.trim());
};

/** Why a name a student typed cannot be used, or null when it is fine. */
export const displayNameProblem = (displayName: string): string | null => {
  const trimmed = displayName.trim();
  if (trimmed.length < 2) return "Please enter your full name";
  if (trimmed.length > 100) return "Name must be 100 characters or less";
  if (isPlaceholderDisplayName(trimmed)) return "Please enter your real name, not User_ or User followed by a number";
  if (containsEmoji(trimmed)) return NAME_EMOJI_MESSAGE;
  return null;
};

export const REVIEW_NAME_REQUIRED_MESSAGE = "Add your name before leaving a review.";
