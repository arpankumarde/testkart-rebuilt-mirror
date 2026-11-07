import superjson from "superjson";
import {
  ForbiddenError,
  getAdminServerSessionOrThrow,
  getAdminSessionId,
  NotAuthenticatedError,
} from "../../../helpers/getAdminSession";
import { listAdminSessions } from "../../../helpers/adminSessions";
import { OutputType } from "./sessions_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const sessions = await listAdminSessions(admin.id, getAdminSessionId(request));
    return new Response(superjson.stringify({ sessions } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 403 });
    }
    console.error("Error listing admin sessions:", error);
    return new Response(superjson.stringify({ error: "Your sign-ins could not be loaded. Try again." }), {
      status: 500,
    });
  }
}
