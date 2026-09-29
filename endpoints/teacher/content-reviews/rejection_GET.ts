import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { hasPendingReview, loadContentState, rejectedReviews } from "../../../helpers/contentReviewQueue";
import { schema, OutputType } from "./rejection_GET.schema";

/* The admin's reason for the teacher's editor while a rejected item waits to be fixed and resubmitted. */
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

    const state = await loadContentState(db, contentType, contentId);
    let rejection: OutputType["rejection"] = null;
    if (
      state &&
      state.teacherId === effectiveTeacherId &&
      !state.live &&
      !(await hasPendingReview(db, contentType, contentId))
    ) {
      rejection = (await rejectedReviews(db, contentType, [contentId])).get(contentId) ?? null;
    }

    const output: OutputType = { rejection };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error loading content rejection:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}