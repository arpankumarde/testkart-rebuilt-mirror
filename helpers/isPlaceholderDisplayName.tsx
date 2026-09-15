/**
 * True when a display name is a system-generated placeholder rather than a name
 * the person actually chose.
 *
 * OTP login is the only path that invents one: both
 * endpoints/auth/mobile-login/verify-otp_POST.ts and its email twin set
 * `User_${id}`. Every other signup path takes a real name from the form or the
 * OAuth provider.
 *
 * The underscore is required, so the match is unmistakably the generated form.
 * "Userdrakes", "UserID" and "user2301" are names people picked and are left
 * alone; only "User_2324" and friends are treated as placeholders.
 */
const PLACEHOLDER_PATTERN = /^user_/i;

export const isPlaceholderDisplayName = (
  displayName: string | null | undefined
): boolean => {
  if (!displayName) return true;
  return PLACEHOLDER_PATTERN.test(displayName.trim());
};
