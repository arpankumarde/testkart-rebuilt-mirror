import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./review_POST.schema";
import { publishApprovedContent } from "../../../helpers/contentReviewQueue";
import { getContentTitle, sendReviewEmail } from "../../../helpers/contentReviewEmail";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Fetch the review record
    const review = await db
      .selectFrom("contentReviews")
      .selectAll()
      .where("id", "=", input.reviewId)
      .executeTakeFirst();

    if (!review) {
      return new Response(superjson.stringify({ error: "Review not found" }), {
        status: 404,
      });
    }

    if (review.status !== "pending") {
      return new Response(
        superjson.stringify({
          error: `Review has already been ${review.status}. Only pending reviews can be actioned.`,
        }),
        { status: 400 }
      );
    }

    // Fetch teacher info for email
    const teacher = await db
      .selectFrom("users")
      .select(["id", "displayName", "email"])
      .where("id", "=", review.teacherId)
      .executeTakeFirst();

    const now = new Date();

    if (input.action === "approve") {
      try {
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("contentReviews")
            .set({
              status: "approved",
              reviewedBy: admin.id,
              reviewedAt: now,
              adminNotes: input.adminNotes ?? null,
              updatedAt: now,
            })
            .where("id", "=", input.reviewId)
            .execute();
          await publishApprovedContent(trx, review.contentType, review.contentId, now);
        });
      } catch (publishError) {
        const reason = publishError instanceof Error ? publishError.message : "It could not be published.";
        return new Response(
          superjson.stringify({ error: `Not approved: ${reason}` }),
          { status: 400 }
        );
      }

      // Send approval email (non-blocking)
      if (teacher?.email) {
        const contentTitle = await getContentTitle(review.contentType, review.contentId);
        sendReviewEmail(
          teacher.email,
          teacher.displayName,
          review.contentType,
          contentTitle,
          "approve",
          input.adminNotes
        ).catch(console.error);
      }

      const output: OutputType = {
        success: true,
        message: "Content approved and published successfully.",
      };
      return new Response(superjson.stringify(output));
    } else {
      // Reject
      if (!input.adminNotes) {
        return new Response(
          superjson.stringify({ error: "Admin notes (rejection reason) are required when rejecting." }),
          { status: 400 }
        );
      }

      await db
        .updateTable("contentReviews")
        .set({
          status: "rejected",
          reviewedBy: admin.id,
          reviewedAt: now,
          adminNotes: input.adminNotes,
          updatedAt: now,
        })
        .where("id", "=", input.reviewId)
        .execute();

      // Send rejection email (non-blocking)
      if (teacher?.email) {
        const contentTitle = await getContentTitle(review.contentType, review.contentId);
        sendReviewEmail(
          teacher.email,
          teacher.displayName,
          review.contentType,
          contentTitle,
          "reject",
          input.adminNotes
        ).catch(console.error);
      }

      const output: OutputType = {
        success: true,
        message: "Content review rejected.",
      };
      return new Response(superjson.stringify(output));
    }
  } catch (error) {
    console.error("Error processing content review:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}