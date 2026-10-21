import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { changeContentVisibility, VisibilityChangeError } from "../../../helpers/contentVisibilityServer";
import { schema, OutputType } from "./update_POST.schema";

/* Switches one teacher item between public and unlisted (rules in helpers/contentVisibilityServer). */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const result = await changeContentVisibility({ ...input, role: user.role, effectiveTeacherId });

    console.log(
      `${input.contentType} ${input.contentId} visibility set to ${result.visibility}${result.inReview ? " (public requested, in review)" : ""} by ${user.role} ${user.id}`
    );

    const output: OutputType = { success: true, ...result };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof VisibilityChangeError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error changing content visibility:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}