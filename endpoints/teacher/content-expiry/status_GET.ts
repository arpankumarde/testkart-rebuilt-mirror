import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { ContentExpiryError, loadContentExpiryStatus } from "../../../helpers/contentExpiryServer";
import { schema, OutputType } from "./status_GET.schema";

/* One item's expiry date and listing status, for the teacher's editor. */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const url = new URL(request.url);
    const { contentType, contentId } = schema.parse({
      contentType: url.searchParams.get("contentType"),
      contentId: url.searchParams.get("contentId"),
    });

    const output: OutputType = await loadContentExpiryStatus(
      contentType,
      contentId,
      user.role === "admin" ? { kind: "admin" } : { kind: "teacher", teacherId: effectiveTeacherId }
    );
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof ContentExpiryError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error loading content expiry:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}