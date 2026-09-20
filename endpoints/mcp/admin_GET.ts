/** GET on the admin connector URL: 401 without a token, 405 with one. See helpers/mcpServer. */

import { handleMcpGet } from "../../helpers/mcpServer";
import { SERVER_NAME } from "../../helpers/mcpToolDefs";

export async function handle(request: Request) {
  return handleMcpGet(request, { audience: "admin", name: SERVER_NAME });
}