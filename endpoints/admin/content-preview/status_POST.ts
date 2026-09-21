import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { AdminModule, hasAdminModule } from "../../../helpers/adminPermissions";
import { loadContentState, publishApprovedContent, takeDownContent } from "../../../helpers/contentReviewQueue";
import { sendReviewEmail } from "../../../helpers/contentReviewEmail";
import { countLiveTestEnrollments } from "../../../helpers/enrollmentCounters";
import { PreviewContentType } from "./details_GET.schema";
import { schema, OutputType } from "./status_POST.schema";

/*
 * Admin status control for one teacher item from its preview page: make it live
 * (approving any pending review), move it back to draft, or reject it with a
 * reason - including items that are already live. Approvals and rejections are
 * recorded as contentReviews rows and emailed to the teacher.
 */

const TYPE_MODULES: Record<PreviewContentType, AdminModule> = {
  mock_test: "test_series",
  course: "courses",
  digital_product: "notes",
  course_bundle: "bundles",
  live_test: "live_tests",
};

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request): Promise<Response> {
  let admin: Awaited<ReturnType<typeof getAdminServerSessionOrThrow>>;
  try {
    admin = await getAdminServerSessionOrThrow(request);
  } catch (error) {
    const notSignedIn = error instanceof Error && error.name === "NotAuthenticatedError";
    return fail(notSignedIn ? "Not authenticated" : error instanceof Error ? error.message : "Access denied", notSignedIn ? 401 : 403);
  }

  try {
    const parsed = schema.safeParse(superjson.parse(await request.text()));
    if (!parsed.success) return fail("Invalid request");
    const { type, id, action } = parsed.data;
    const note = parsed.data.note?.trim() || null;

    if (!hasAdminModule(admin.permissions, ["content_reviews", TYPE_MODULES[type]])) {
      return fail("Your admin account cannot change the status of this kind of content.", 403);
    }

    const state = await loadContentState(db, type, id);
    if (!state) return fail("This item no longer exists", 404);

    const pending = await db
      .selectFrom("contentReviews")
      .select("id")
      .where("contentType", "=", type)
      .where("contentId", "=", id)
      .where("status", "=", "pending")
      .executeTakeFirst();
    const now = new Date();

    if (action === "reject" && !note) return fail("Add a reason. The teacher sees it in the email.");
    if (action === "publish" && state.live && !pending) return fail("This item is already live.");
    if (action === "unpublish" && !state.live) return fail("This item is not live.");
    if (action === "reject" && !state.live && !pending) return fail("This item is not live or waiting for review.");

    if (action !== "publish" && state.live && type === "live_test") {
      if (state.endTime && state.endTime <= now) return fail("This live test has already ended, so it cannot be taken down.");
      const registered = await countLiveTestEnrollments(id);
      if (registered > 0) {
        return fail(
          `${registered} ${registered === 1 ? "student has" : "students have"} registered for this live test, so it cannot be taken down here.`
        );
      }
    }

    try {
      await db.transaction().execute(async (trx) => {
        if (action === "publish") await publishApprovedContent(trx, type, id, now);
        else if (state.live) await takeDownContent(trx, type, id, now);
        if (action === "unpublish") return;

        const review = {
          status: action === "publish" ? ("approved" as const) : ("rejected" as const),
          reviewedBy: admin.id,
          reviewedAt: now,
          adminNotes: note,
          updatedAt: now,
        };
        if (pending) {
          await trx.updateTable("contentReviews").set(review).where("id", "=", pending.id).execute();
        } else {
          await trx
            .insertInto("contentReviews")
            .values({ contentType: type, contentId: id, teacherId: state.teacherId, ...review })
            .execute();
        }
      });
    } catch (error) {
      if (action !== "publish") throw error;
      return fail(`Not made live: ${error instanceof Error ? error.message : "it could not be published."}`);
    }

    if (action !== "unpublish") {
      const teacher = await db
        .selectFrom("users")
        .select(["displayName", "email"])
        .where("id", "=", state.teacherId)
        .executeTakeFirst();
      if (teacher?.email) {
        await sendReviewEmail(teacher.email, teacher.displayName, type, state.title, action === "publish" ? "approve" : "reject", note);
      }
    }

    const message =
      action === "publish"
        ? "It is live. The teacher has been emailed."
        : action === "unpublish"
          ? "Moved back to draft. Students can no longer find or buy it."
          : state.live
            ? "Rejected and taken off the site. The teacher has been emailed the reason."
            : "Rejected. The teacher has been emailed the reason.";
    return new Response(superjson.stringify({ message } satisfies OutputType));
  } catch (error) {
    console.error("Error changing content status:", error);
    return fail("Could not change the status. Try again.", 500);
  }
}