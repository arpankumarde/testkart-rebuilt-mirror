import { OutputType, schema } from "./apply_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { sendEmail } from "../../helpers/sendEmail";
import { getBrandedEmailHtml } from "../../helpers/emailBaseTemplate";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Verify the career posting exists and is active
    const career = await db
      .selectFrom("careerPostings")
      .select(["title", "department", "location"])
      .where("id", "=", input.careerPostingId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!career) {
      return new Response(
        superjson.stringify({ error: "Career posting not found or is inactive" }),
        { status: 404 }
      );
    }

    // Insert the application into the database
    await db
      .insertInto("careerApplications")
      .values({
        careerPostingId: input.careerPostingId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        resumeUrl: input.resumeUrl ?? null,
        resumeFileId: input.resumeFileId ?? null,
        coverLetter: input.coverLetter ?? null,
      })
      .execute();

    // Format Email content
    const htmlContent = getBrandedEmailHtml({
      title: `New Job Application: ${career.title}`,
      icon: "📄",
      heading: "New Job Application",
      subheading: `For the ${career.title} position`,
      table: [
        { label: "Applicant Name", value: input.name, emphasize: true },
        { label: "Email", value: `<a href="mailto:${input.email}">${input.email}</a>` },
        { label: "Phone", value: input.phone || "N/A" },
        { label: "Department", value: career.department || "N/A" },
        { label: "Location", value: career.location || "N/A" },
        { label: "LinkedIn", value: input.linkedinUrl ? `<a href="${input.linkedinUrl}">${input.linkedinUrl}</a>` : "N/A" },
        { label: "Resume", value: input.resumeUrl ? `<a href="${input.resumeUrl}">View Resume</a>` : "N/A" },
      ],
      bodyHtml: input.coverLetter
        ? `<p style="margin:0 0 8px;font-weight:600;">Cover Letter</p><p style="margin:0;white-space:pre-wrap;">${input.coverLetter}</p>`
        : undefined,
    });

    const emailResult = await sendEmail({
      to: "ham@testkart.in",
      replyTo: input.email,
      subject: `New Job Application: ${career.title} - ${input.name}`,
      html: htmlContent,
      text: `New application for ${career.title} from ${input.name} (${input.email}). Phone: ${input.phone}. LinkedIn: ${input.linkedinUrl}. Resume: ${input.resumeUrl}. Cover Letter: ${input.coverLetter}`,
    });

    if (!emailResult.success) {
      console.error("Failed to send application email:", emailResult.error);
      return new Response(
        superjson.stringify({ error: "Failed to send application email. Please try again later." }),
        { status: 500 }
      );
    }

    return new Response(
      superjson.stringify({
        success: true,
        message: "Application submitted successfully",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error processing application:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 500 }
    );
  }
}