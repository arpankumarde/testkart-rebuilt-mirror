/**
 * Whether an OAuth redirectTo is a mobile app link that may receive the login
 * token in its URL. Anything else must be a same-site path (validateRedirectPath).
 * - testkart: the installed Testkart app.
 * - exp: Expo Go during development, only for a dev server on localhost or a
 *   private network. Expo Go opens whatever project an exp:// link points at,
 *   so a public host would let that project read the token.
 */
const PRIVATE_HOST =
  /^(localhost|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;

export function isAppDeepLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "testkart:") return true;
    return parsed.protocol === "exp:" && PRIVATE_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}
