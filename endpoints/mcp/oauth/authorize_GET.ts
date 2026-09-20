/**
 * Authorization endpoint of the shared MCP issuer. Sends the browser to the authorize page of the
 * connector named by `resource`, where the sign-in check and consent happen.
 */

import { handleSharedAuthorizeGet } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleSharedAuthorizeGet(request);
}