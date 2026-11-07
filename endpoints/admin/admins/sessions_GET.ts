import superjson from "superjson";
import { ZodError } from "zod";
import {
  assertSuperAdmin,
  ForbiddenError,
  getAdminServerSessionOrThrow,
  getAdminSessionId,
  NotAuthenticatedError,
} from "../../../helpers/getAdminSession";
import { listAdminSessions } from "../../../helpers/adminSessions";
import { schema, OutputType } from "./sessions_GET.schema";

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

/** Any admin's sign-ins, for a super admin. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    assertSuperAdmin(admin);
    const { adminId } = schema.parse({ adminId: new URL(request.url).searchParams.get("adminId") });
    const sessions = await listAdminSessions(adminId, adminId === admin.id ? getAdminSessionId(request) : undefined);
    return new Response(superjson.stringify({ sessions } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return errorResponse("Not authenticated", 401);
    if (error instanceof ForbiddenError) return errorResponse(error.message, 403);
    if (error instanceof ZodError) return errorResponse("Choose an admin.", 400);
    console.error("Error listing an admin's sessions:", error);
    return errorResponse("The sign-ins could not be loaded. Try again.", 500);
  }
}
