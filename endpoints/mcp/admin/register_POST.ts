/** RFC 7591 dynamic client registration for the admin MCP connector. */

import { handleRegister } from "../../../helpers/mcpOauthEndpoints";

export async function handle(request: Request) {
  return handleRegister(request);
}