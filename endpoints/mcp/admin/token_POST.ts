/** OAuth token endpoint for the admin MCP connector: code exchange and refresh-token rotation. */

import { handleToken } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleToken(request, "admin");
}