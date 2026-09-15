/**
 * OAuth authorization endpoint for the admin MCP connector. Requires an existing admin session;
 * there is no password field, so this adds no new place to submit admin credentials.
 */

import { handleAuthorizeGet } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleAuthorizeGet(request, "admin");
}