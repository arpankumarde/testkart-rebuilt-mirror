import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { ContentExpiryError, setContentExpiry } from "../../../helpers/contentExpiryServer";
import { schema, OutputType } from "./update_POST.schema";

/* Sets or removes one teacher item's expiry date (rules in helpers/contentExpiryServer). */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const output: OutputType = await setContentExpiry({
      ...input,
      access: user.role === "admin" ? { kind: "admin" } : { kind: "teacher", teacherId: effectiveTeacherId },
    });
    console.log(`${input.contentType} ${input.contentId} expiry set to ${input.expiryDay ?? "none"} by ${user.role} ${user.id}`);
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof ContentExpiryError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error updating content expiry:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}