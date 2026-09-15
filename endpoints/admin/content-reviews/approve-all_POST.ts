import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./approve-all_POST.schema";
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
    action === "approve"
      ? "content_review_approved"
      : "content_review_rejected";

  try {
    const template = await getEmailTemplate(templateKey);
    if (!template) {
      console.warn(
        `Email template '${templateKey}' not found or inactive, skipping email.`
      );
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

async function getContentTitle(
  contentType: string,
  contentId: number
): Promise<string> {
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

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const json = superjson.parse(await request.text());
    schema.parse(json); // Validate empty body

    const now = new Date();

    // Find all pending reviews
    const pendingReviews = await db
      .selectFrom("contentReviews")
      .selectAll()
      .where("status", "=", "pending")
      .execute();

    if (pendingReviews.length === 0) {
      const output: OutputType = {
        success: true,
        approvedCount: 0,
        message: "No pending reviews found.",
      };
      return new Response(superjson.stringify(output));
    }

    // Process all updates in a single transaction
    await db.transaction().execute(async (trx) => {
      for (const review of pendingReviews) {
        // 1. Update the review record
        await trx
          .updateTable("contentReviews")
          .set({
            status: "approved",
            reviewedBy: admin.id,
            reviewedAt: now,
            updatedAt: now,
          })
          .where("id", "=", review.id)
          .execute();

        // 2. Publish the content based on type
        switch (review.contentType) {
          case "mock_test":
            await trx
              .updateTable("mockTests")
              .set({
                isPublished: true,
                wasEverPublished: true,
                updatedAt: now,
              })
              .where("id", "=", review.contentId)
              .execute();
            break;

          case "course":
            await trx
              .updateTable("courses")
              .set({ status: "published", publishedAt: now, updatedAt: now })
              .where("id", "=", review.contentId)
              .execute();
            break;

          case "digital_product":
            await trx
              .updateTable("digitalProducts")
              .set({
                status: "published",
                isPublished: true,
                publishedAt: now,
                updatedAt: now,
              })
              .where("id", "=", review.contentId)
              .execute();
            break;

          case "course_bundle":
            await trx
              .updateTable("courseBundles")
              .set({ isPublished: true, publishedAt: now, updatedAt: now })
              .where("id", "=", review.contentId)
              .execute();
            break;

          case "live_test": {
            // Activate the live test
            await trx
              .updateTable("liveTests")
              .set({ isActive: true, updatedAt: now })
              .where("id", "=", review.contentId)
              .execute();

            // Also publish the associated mock test
            const liveTest = await trx
              .selectFrom("liveTests")
              .select("mockTestId")
              .where("id", "=", review.contentId)
              .executeTakeFirst();

            if (liveTest) {
              await trx
                .updateTable("mockTests")
                .set({
                  isPublished: true,
                  wasEverPublished: true,
                  updatedAt: now,
                })
                .where("id", "=", liveTest.mockTestId)
                .execute();
            }
            break;
          }

          default:
            console.warn(
              `Unknown content type for publishing: ${review.contentType}`
            );
        }
      }
    });

    // Send emails after successful transaction commit
    // Using a non-blocking execution via .catch on the promise chains
    const emailPromises = pendingReviews.map(async (review) => {
      try {
        const teacher = await db
          .selectFrom("users")
          .select(["id", "displayName", "email"])
          .where("id", "=", review.teacherId)
          .executeTakeFirst();

        if (teacher?.email) {
          const contentTitle = await getContentTitle(
            review.contentType,
            review.contentId
          );
          await sendReviewEmail(
            teacher.email,
            teacher.displayName,
            review.contentType,
            contentTitle,
            "approve"
          );
        }
      } catch (err) {
        console.error(
          `Failed to process approval email for review ${review.id}:`,
          err
        );
      }
    });

    // Fire and forget emails
    Promise.allSettled(emailPromises);

    const output: OutputType = {
      success: true,
      approvedCount: pendingReviews.length,
      message: `Successfully approved and published ${pendingReviews.length} item(s).`,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error processing bulk content approval:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      error instanceof Error && error.name === "NotAuthenticatedError"
        ? 401
        : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}