/** RFC 7591 dynamic client registration for the shared MCP issuer. */

import { handleRegister } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleRegister(request);
}