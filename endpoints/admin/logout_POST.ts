import { clearAdminServerSession } from "../../helpers/getAdminSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const response = new Response(
      superjson.stringify({ success: true, message: "Logged out successfully" })
    );
    clearAdminServerSession(response);
    return response;
  } catch (error) {
    console.error("Admin logout error:", error);
    return new Response(
      superjson.stringify({
        error: "Logout failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}