import superjson from "superjson";
import { ZodError } from "zod";
import { getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../../helpers/getAdminSession";
import { revokeMcpConnection } from "../../../helpers/mcpConnections";
import { schema, OutputType } from "./revoke_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const { clientName } = schema.parse(superjson.parse(await request.text()));
    const revoked = await revokeMcpConnection("admin", admin.id, clientName);
    if (revoked === 0) {
      return new Response(superjson.stringify({ error: `${clientName} is not connected to your admin account.` }), {
        status: 404,
      });
    }

    const output: OutputType = { revoked };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof ZodError) {
      return new Response(superjson.stringify({ error: "Choose an app to disconnect." }), { status: 400 });
    }
    console.error("Error revoking admin AI connection:", error);
    return new Response(superjson.stringify({ error: "The app could not be disconnected. Try again." }), {
      status: 500,
    });
  }
}