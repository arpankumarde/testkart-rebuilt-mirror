import superjson from "superjson";
import {
  endAdminImpersonation,
  getAdminServerSessionOrThrow,
  NotAuthenticatedError,
} from "../../../helpers/getAdminSession";
import { OutputType } from "./stop-impersonating_POST.schema";

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

/** Ends a "signed in as" session and returns the browser to the super admin's own account. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const response = new Response(superjson.stringify({ restored: true } satisfies OutputType));
    const outcome = await endAdminImpersonation(response, request);

    if (outcome === "not_impersonating") {
      return errorResponse("You are signed in to your own account.", 400);
    }
    console.log(`Admin ${admin.impersonator?.id} stopped being signed in as admin ${admin.id} (${outcome})`);
    if (outcome === "signed_out") {
      const signedOut = new Response(superjson.stringify({ restored: false } satisfies OutputType));
      response.headers.forEach((value, name) => {
        if (name.toLowerCase() === "set-cookie") signedOut.headers.append("Set-Cookie", value);
      });
      return signedOut;
    }
    return response;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return errorResponse("Not authenticated", 401);
    console.error("Error returning from an impersonated admin session:", error);
    return errorResponse("Could not return to your account. Try again.", 500);
  }
}
