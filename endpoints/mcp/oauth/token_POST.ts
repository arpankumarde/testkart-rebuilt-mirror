/** Token endpoint of the shared MCP issuer: code exchange and refresh for either connector. */

import { handleToken } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleToken(request, null);
}