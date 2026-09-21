import { schema, OutputType } from "./stopImpersonating_POST.schema";
import superjson from 'superjson';
import { clearServerSession } from "../../helpers/getSetServerSession";
import { getAdminServerSessionOrThrow } from "../../helpers/getAdminSession";

export async function handle(request: Request): Promise<Response> {
  try {
    // We still check for an admin session to ensure this endpoint is protected,
    // even though we are clearing the user session.
    await getAdminServerSessionOrThrow(request);

    const response = new Response(superjson.stringify({ success: true } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });

    // Clear the user session cookie
    clearServerSession(response);

    return response;

  } catch (error) {
    console.error("Failed to stop impersonation:", error);
    if (error instanceof Error && error.name === 'NotAuthenticatedError') {
        return new Response(superjson.stringify({ error: "Admin not authenticated." }), { status: 401 });
    }
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred." }), { status: 400 });
  }
}