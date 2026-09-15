/**
 * Validates that a redirect path is safe to use (local path starting with /)
 * to prevent open redirect vulnerabilities.
 * 
 * @param redirectTo - The redirect path to validate
 * @returns The validated path if safe, null otherwise
 */
export const validateRedirectPath = (redirectTo: string | null): string | null => {
  if (!redirectTo) {
    return null;
  }
  
  // Ensure it's a string and starts with /
  if (typeof redirectTo !== "string" || !redirectTo.startsWith("/")) {
    return null;
  }
  
  // Prevent protocol-relative URLs like //evil.com
  if (redirectTo.startsWith("//")) {
    return null;
  }
  
  return redirectTo;
};