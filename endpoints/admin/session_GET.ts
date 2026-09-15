import {
  getAdminServerSessionOrThrow,
  NotAuthenticatedError,
} from "../../helpers/getAdminSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    return new Response(superjson.stringify({ admin }));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    console.error("Admin session validation error:", error);
    return new Response(
      superjson.stringify({ error: "Session validation failed" }),
      { status: 400 }
    );
  }
}