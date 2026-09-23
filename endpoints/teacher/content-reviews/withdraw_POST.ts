import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { clearOpenReviews, loadContentState } from "../../../helpers/contentReviewQueue";
import { CONTENT_NOUNS } from "../../../helpers/contentReviewStatus";
import { schema, OutputType } from "./withdraw_POST.schema";

/*
 * The teacher takes an item back out of the review queue. Content waiting for
 * review is never live, so removing the waiting review leaves it a draft that
 * can be edited and submitted again.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const { contentType, contentId } = schema.parse(superjson.parse(await request.text()));
    const noun = CONTENT_NOUNS[contentType];

    const state = await loadContentState(db, contentType, contentId);
    if (!state || state.teacherId !== effectiveTeacherId) {
      return new Response(superjson.stringify({ error: `This ${noun} was not found in your account.` }), {
        status: 404,
      });
    }

    if (state.live) {
      return new Response(
        superjson.stringify({ error: `This ${noun} is already live, so there is nothing to take back.` }),
        { status: 400 }
      );
    }

    const removed = await clearOpenReviews(db, contentType, contentId);
    if (removed === 0) {
      return new Response(
        superjson.stringify({ error: `This ${noun} is not waiting for review. It may have just been approved or rejected.` }),
        { status: 400 }
      );
    }

    console.log(`${contentType} ${contentId} taken back from review by teacher ${effectiveTeacherId}`);

    const output: OutputType = {
      success: true,
      message: `Your ${noun} is a draft again. Edit it and submit it for review when it is ready.`,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error taking content back from review:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}