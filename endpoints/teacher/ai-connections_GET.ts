import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { listMcpConnections } from "../../helpers/mcpConnections";
import { OutputType } from "./ai-connections_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts have a teacher connector." }), {
        status: 403,
      });
    }

    // The token pair belongs to whoever approved it, so a team manager sees their own connections.
    const output: OutputType = { connections: await listMcpConnections("teacher", user.id) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error listing teacher AI connections:", error);
    return new Response(superjson.stringify({ error: "Your AI connections could not be loaded." }), {
      status: 500,
    });
  }
}