/**
 * OAuth authorization endpoint for the teacher MCP connector. Requires an existing teacher
 * session; there is no password or OTP field, so this adds no new place to sign in.
 */

import { handleAuthorizeGet } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleAuthorizeGet(request, "teacher");
}