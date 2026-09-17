import { schema, OutputType } from "./create_POST.schema";
import superjson from 'superjson';
 import { db } from "../../../../helpers/db";
 import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { sendTemplateEmail, ADMIN_EMAIL } from "../../../../helpers/sendTemplateEmail";
import { sendEmail } from "../../../../helpers/sendEmail";
import { getBrandedEmailHtml } from "../../../../helpers/emailBaseTemplate";
import { supportMessageEmailHtml } from "../../../../helpers/supportAttachmentRules";
import { insertSupportAttachments, verifySupportAttachments } from "../../../../helpers/supportAttachmentStorage";

const TEACHER_SUPPORT_TICKETS_EMAIL = "teacher-support-tickets@testkart.in";
 
export async function handle(request: Request) {
   try {
     const { effectiveTeacherId, user, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }
    if (teacherRole === "manager") {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const attachments = await verifySupportAttachments(input.attachments);

    const thread = await db.transaction().execute(async (trx) => {
      const newThread = await trx.insertInto("supportThreads")
        .values({
          teacherId: effectiveTeacherId,
          subject: input.subject,
          status: "open",
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const firstMessage = await trx.insertInto("supportMessages")
        .values({
          threadId: newThread.id,
          senderType: "teacher",
          senderId: effectiveTeacherId,
          messageText: input.message,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await insertSupportAttachments(trx, firstMessage.id, attachments);

       return newThread;
    });
 
     const teacher = await db.selectFrom("users")
      .select(["displayName", "email"])
       .where("id", "=", effectiveTeacherId)
       .executeTakeFirst();
     
    const teacherName = teacher?.displayName || "Unknown Teacher";
    const teacherEmail = teacher?.email || "N/A";
    const ticketId = thread.id;
    const ticketTimestamp = new Date().toISOString();

     await sendTemplateEmail("support_ticket_admin_notification", ADMIN_EMAIL, {
      teacherName,
       teacherId: String(effectiveTeacherId),
       subject: input.subject,
       category: "General",
    }).catch(err => console.error("Failed to send support notification email:", err));

    const htmlContent = getBrandedEmailHtml({
      title: "New Teacher Support Ticket",
      icon: "🎫",
      accent: "info",
      heading: "New Teacher Support Ticket",
      subheading: `Ticket #${ticketId} · ${input.subject}`,
      table: [
        { label: "Teacher Name", value: teacherName },
        { label: "Teacher ID", value: String(effectiveTeacherId) },
        { label: "Teacher Email", value: teacherEmail },
        { label: "Timestamp", value: ticketTimestamp },
      ],
      bodyHtml: `
        <p style="margin:0 0 8px;font-weight:600;">Message</p>
        ${supportMessageEmailHtml(input.message, attachments)}
      `,
      footerNote: "This is an automated notification sent from Testkart.",
    });

            await sendEmail({
      to: TEACHER_SUPPORT_TICKETS_EMAIL,
      subject: `[Support Ticket #${ticketId}] ${input.subject}`,
      html: htmlContent,
    }).catch(err => console.error("Failed to send support ticket notification email:", err));

     return new Response(superjson.stringify(thread satisfies OutputType));
   } catch (error) {
     return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}