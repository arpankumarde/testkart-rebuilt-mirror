import { schema, OutputType } from "./send-test_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { sendEmail } from "../../../helpers/sendEmail";
import { fillWithSamples } from "../../../helpers/emailPreviewSamples";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    // Require admin authentication
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { templateId, recipientEmail } = schema.parse(json);

    // Fetch the template
    const template = await db
      .selectFrom("emailTemplates")
      .select(["subject", "htmlContent", "textContent", "placeholders"])
      .where("id", "=", templateId)
      .executeTakeFirst();

    if (!template) {
      return new Response(
        superjson.stringify({
          error: "Template not found",
        }),
        { status: 404 }
      );
    }

    // Fill placeholders with the same sample values the admin preview uses, so
    // a test email and the preview pane render identically.
    const subject = fillWithSamples(template.subject);
    const htmlContent = fillWithSamples(template.htmlContent);
    const textContent = fillWithSamples(template.textContent);

    // Send the email
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${subject}`,
      html: htmlContent,
      text: textContent || undefined,
    });

    if (!emailResult.success) {
      console.error("Failed to send test email:", emailResult.error);
      return new Response(
        superjson.stringify({
          error: "Failed to send email via provider",
        }),
        { status: 500 }
      );
    }

    return new Response(
      superjson.stringify({
        success: true,
        message: `Test email sent to ${recipientEmail}`,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error sending test email:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}