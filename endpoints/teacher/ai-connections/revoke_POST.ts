import superjson from "superjson";
import { ZodError } from "zod";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { revokeMcpConnection } from "../../../helpers/mcpConnections";
import { schema, OutputType } from "./revoke_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(superjson.stringify({ error: "Only teacher accounts have a teacher connector." }), {
        status: 403,
      });
    }

    const { clientName } = schema.parse(superjson.parse(await request.text()));
    const revoked = await revokeMcpConnection("teacher", user.id, clientName);
    if (revoked === 0) {
      return new Response(superjson.stringify({ error: `${clientName} is not connected to your account.` }), {
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
    console.error("Error revoking teacher AI connection:", error);
    return new Response(superjson.stringify({ error: "The app could not be disconnected. Try again." }), {
      status: 500,
    });
  }
}