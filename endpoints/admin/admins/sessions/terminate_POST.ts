import superjson from "superjson";
import { ZodError } from "zod";
import {
  assertSuperAdmin,
  ForbiddenError,
  getAdminServerSessionOrThrow,
  NotAuthenticatedError,
} from "../../../../helpers/getAdminSession";
import { revokeAdminSession, signOutAdminEverywhere } from "../../../../helpers/adminSessions";
import { schema, OutputType } from "./terminate_POST.schema";

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

/** A super admin ends another admin's sign-ins. Their own are managed on Profile. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    assertSuperAdmin(admin);
    const input = schema.parse(superjson.parse(await request.text()));

    if (input.adminId === admin.id) {
      return errorResponse("Manage your own signed-in devices from your Profile.", 400);
    }

    if ("all" in input) {
      const terminated = await signOutAdminEverywhere(input.adminId);
      console.log(`Admin ${admin.id} signed admin ${input.adminId} out everywhere (${terminated} sessions)`);
      return new Response(superjson.stringify({ terminated } satisfies OutputType));
    }

    const ended = await revokeAdminSession(input.adminId, input.sessionId);
    if (!ended) return errorResponse("That sign-in has already ended.", 404);
    console.log(`Admin ${admin.id} ended a session of admin ${input.adminId}`);
    return new Response(superjson.stringify({ terminated: 1 } satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return errorResponse("Not authenticated", 401);
    if (error instanceof ForbiddenError) return errorResponse(error.message, 403);
    if (error instanceof ZodError) return errorResponse("Choose a sign-in to end.", 400);
    console.error("Error ending an admin's session:", error);
    return errorResponse("The sign-in could not be ended. Try again.", 500);
  }
}
