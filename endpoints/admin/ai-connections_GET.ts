import superjson from "superjson";
import { getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../helpers/getAdminSession";
import { listMcpConnections } from "../../helpers/mcpConnections";
import { OutputType } from "./ai-connections_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const output: OutputType = { connections: await listMcpConnections("admin", admin.id) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error listing admin AI connections:", error);
    return new Response(superjson.stringify({ error: "Your AI connections could not be loaded." }), {
      status: 500,
    });
  }
}