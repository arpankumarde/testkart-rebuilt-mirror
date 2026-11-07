import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../../helpers/db";
import {
  clearAdminServerSession,
  ForbiddenError,
  getAdminServerSessionOrThrow,
  getAdminSessionId,
  NotAuthenticatedError,
  setAdminServerSession,
} from "../../../../helpers/getAdminSession";
import { revokeAdminSession, revokeAdminSessions } from "../../../../helpers/adminSessions";
import { schema, OutputType } from "./terminate_POST.schema";

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const currentSessionId = getAdminSessionId(request);
    const input = schema.parse(superjson.parse(await request.text()));

    if ("others" in input) {
      // Only a browser sign-in has a session to keep; anything else would sign out every browser.
      if (!currentSessionId) {
        return errorResponse("Open the admin panel in a browser to sign out your other devices.", 400);
      }
      const terminated = await revokeAdminSessions(admin.id, currentSessionId);

      // Also ends older sign-ins that have not been seen since sessions were recorded and so have
      // no row to revoke. Whole seconds, because a cookie's issue time carries no milliseconds
      // and the one re-issued below must not fall before the cutoff.
      const cutoff = new Date(Math.floor(Date.now() / 1000) * 1000);
      await db.updateTable("admins").set({ sessionInvalidatedAt: cutoff }).where("id", "=", admin.id).execute();

      const response = new Response(
        superjson.stringify({ terminated, signedOutSelf: false } satisfies OutputType)
      );
      await setAdminServerSession(response, admin, request, currentSessionId);
      return response;
    }

    const ended = await revokeAdminSession(admin.id, input.sessionId);
    if (!ended) {
      return errorResponse("That sign-in has already ended.", 404);
    }

    const signedOutSelf = input.sessionId === currentSessionId;
    const response = new Response(
      superjson.stringify({ terminated: 1, signedOutSelf } satisfies OutputType)
    );
    if (signedOutSelf) clearAdminServerSession(response);
    return response;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return errorResponse("Not authenticated", 401);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(error.message, 403);
    }
    if (error instanceof ZodError) {
      return errorResponse("Choose a sign-in to end.", 400);
    }
    console.error("Error ending admin session:", error);
    return errorResponse("The sign-in could not be ended. Try again.", 500);
  }
}
