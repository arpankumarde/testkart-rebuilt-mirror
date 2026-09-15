/** Consent submission for the admin MCP connector. Issues an authorization code and redirects. */

import { handleAuthorizePost } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleAuthorizePost(request, "admin");
}