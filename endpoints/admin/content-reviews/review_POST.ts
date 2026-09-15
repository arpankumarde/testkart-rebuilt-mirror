import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./review_POST.schema";
import { sendEmail } from "../../../helpers/sendEmail";

async function getEmailTemplate(templateKey: string) {
  return db
    .selectFrom("emailTemplates")
    .selectAll()
    .where("templateKey", "=", templateKey)
    .where("isActive", "=", true)
    .executeTakeFirst();
}

function replacePlaceholders(
  text: string,
  replacements: Record<string, string>
): string {
  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

async function sendReviewEmail(
  teacherEmail: string,
  teacherName: string,
  contentType: string,
  contentTitle: string,
  action: "approve" | "reject",
  adminNotes?: string | null
) {
  const templateKey =
    action === "approve" ? "content_review_approved" : "content_review_rejected";

  try {
    const template = await getEmailTemplate(templateKey);
    if (!template) {
      console.warn(`Email template '${templateKey}' not found or inactive, skipping email.`);
      return;
    }

    const replacements: Record<string, string> = {
      displayName: teacherName,
      contentType: contentType.replace(/_/g, " "),
      contentTitle,
      adminNotes: adminNotes ?? "",
    };

    const html = replacePlaceholders(template.htmlContent, replacements);
    const text = template.textContent
      ? replacePlaceholders(template.textContent, replacements)
      : undefined;
    const subject = replacePlaceholders(template.subject, replacements);

    await sendEmail({ to: teacherEmail, subject, html, text });
  } catch (err) {
    console.error(`Failed to send review email (${templateKey}):`, err);
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

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
      // Update the review record
      await db
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

      // Publish the content based on type
      switch (review.contentType) {
        case "mock_test":
          await db
            .updateTable("mockTests")
            .set({ isPublished: true, wasEverPublished: true, updatedAt: now })
            .where("id", "=", review.contentId)
            .execute();
          break;

        case "course":
          await db
            .updateTable("courses")
            .set({ status: "published", publishedAt: now, updatedAt: now })
            .where("id", "=", review.contentId)
            .execute();
          break;

        case "digital_product":
          await db
            .updateTable("digitalProducts")
            .set({ status: "published", isPublished: true, publishedAt: now, updatedAt: now })
            .where("id", "=", review.contentId)
            .execute();
          break;

        case "course_bundle":
          await db
            .updateTable("courseBundles")
            .set({ isPublished: true, publishedAt: now, updatedAt: now })
            .where("id", "=", review.contentId)
            .execute();
          break;

        case "live_test": {
          // Activate the live test
          await db
            .updateTable("liveTests")
            .set({ isActive: true, updatedAt: now })
            .where("id", "=", review.contentId)
            .execute();
          // Also publish the associated mock test
          const liveTest = await db
            .selectFrom("liveTests")
            .select("mockTestId")
            .where("id", "=", review.contentId)
            .executeTakeFirst();
          if (liveTest) {
            await db
              .updateTable("mockTests")
              .set({ isPublished: true, wasEverPublished: true, updatedAt: now })
              .where("id", "=", liveTest.mockTestId)
              .execute();
          }
          break;
        }

        default:
          console.warn(`Unknown content type for publishing: ${review.contentType}`);
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

async function getContentTitle(contentType: string, contentId: number): Promise<string> {
  try {
    switch (contentType) {
      case "mock_test": {
        const row = await db
          .selectFrom("mockTests")
          .select("title")
          .where("id", "=", contentId)
          .executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "course": {
        const row = await db
          .selectFrom("courses")
          .select("title")
          .where("id", "=", contentId)
          .executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "digital_product": {
        const row = await db
          .selectFrom("digitalProducts")
          .select("title")
          .where("id", "=", contentId)
          .executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "course_bundle": {
        const row = await db
          .selectFrom("courseBundles")
          .select("title")
          .where("id", "=", contentId)
          .executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      case "live_test": {
        const row = await db
          .selectFrom("liveTests")
          .select("title")
          .where("id", "=", contentId)
          .executeTakeFirst();
        return row?.title ?? "Unknown";
      }
      default:
        return "Unknown";
    }
  } catch {
    return "Unknown";
  }
}