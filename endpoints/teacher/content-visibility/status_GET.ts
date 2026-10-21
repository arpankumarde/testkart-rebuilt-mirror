import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { hasPendingReview, loadContentState, rejectedReviews } from "../../../helpers/contentReviewQueue";
import { loadContentPublicPath } from "../../../helpers/contentVisibilityServer";
import { schema, OutputType } from "./status_GET.schema";

/* An item's visibility, live and review state and share link, for the teacher's editor. */
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
    if (!state || (user.role !== "admin" && state.teacherId !== effectiveTeacherId)) {
      return new Response(superjson.stringify({ error: "Not found" }), { status: 404 });
    }

    const inReview = await hasPendingReview(db, contentType, contentId);
    const publicRequestRejection =
      state.live && state.visibility === "unlisted" && !inReview
        ? (await rejectedReviews(db, contentType, [contentId])).get(contentId) ?? null
        : null;

    const output: OutputType = {
      visibility: state.visibility,
      live: state.live,
      inReview,
      publicPath: await loadContentPublicPath(db, contentType, contentId),
      publicRequestRejection,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error loading content visibility:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}