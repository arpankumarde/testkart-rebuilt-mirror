import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { ContentExpiryError, relistExpiredContent } from "../../../helpers/contentExpiryServer";
import { schema, OutputType } from "./relist_POST.schema";

/* Puts an expired teacher item back on sale; never happens without this explicit call. */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const output: OutputType = await relistExpiredContent({
      ...input,
      access: user.role === "admin" ? { kind: "admin" } : { kind: "teacher", teacherId: effectiveTeacherId },
    });
    console.log(`${input.contentType} ${input.contentId} relisted after expiry as ${output.visibility} by ${user.role} ${user.id}`);
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof ContentExpiryError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error relisting expired content:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}