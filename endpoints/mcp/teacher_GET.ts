/** GET on the teacher connector URL: 401 without a token, 405 with one. See helpers/mcpServer. */

import { handleMcpGet } from "../../helpers/mcpServer";
import { TEACHER_SERVER_NAME } from "../../helpers/mcpTeacherToolDefs";

export async function handle(request: Request) {
  return handleMcpGet(request, { audience: "teacher", name: TEACHER_SERVER_NAME });
}