import { schema, OutputType } from "./reply_POST.schema";
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

    const thread = await db.selectFrom("supportThreads")
      .where("id", "=", input.threadId)
      .where("teacherId", "=", effectiveTeacherId)
      .selectAll()
      .executeTakeFirst();

    if (!thread) {
      return new Response(superjson.stringify({ error: "Thread not found" }), { status: 404 });
    }
    if (thread.status === "closed") {
      return new Response(superjson.stringify({ error: "Cannot reply to a closed thread" }), { status: 400 });
    }

    const attachments = await verifySupportAttachments(input.attachments);

    const message = await db.transaction().execute(async (trx) => {
      const newMessage = await trx.insertInto("supportMessages")
        .values({
          threadId: thread.id,
          senderType: "teacher",
          senderId: effectiveTeacherId,
          messageText: input.message,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await insertSupportAttachments(trx, newMessage.id, attachments);

      const updates: any = {
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Auto-reopen the thread if it was marked as resolved
      if (thread.status === "resolved") {
        updates.status = "open";
      }

      await trx.updateTable("supportThreads")
        .set(updates)
        .where("id", "=", thread.id)
        .execute();

       return newMessage;
    });
 
     const teacher = await db.selectFrom("users")
      .select(["displayName", "email"])
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();

    const teacherName = teacher?.displayName || "Unknown Teacher";
    const teacherEmail = teacher?.email || "N/A";
    const replyTimestamp = new Date().toISOString();

    await sendTemplateEmail("support_reply_to_admin", ADMIN_EMAIL, {
      teacherName,
      subject: thread.subject,
    }).catch(err => console.error("Failed to send support reply email to admin:", err));

    const htmlContent = getBrandedEmailHtml({
      title: "Teacher Replied to Support Ticket",
      icon: "💬",
      accent: "info",
      heading: "Teacher Replied to Support Ticket",
      subheading: `Ticket #${thread.id} · ${thread.subject}`,
      table: [
        { label: "Teacher Name", value: teacherName },
        { label: "Teacher Email", value: teacherEmail },
        { label: "Timestamp", value: replyTimestamp },
      ],
      bodyHtml: `
        <p style="margin:0 0 8px;font-weight:600;">Reply Message</p>
        ${supportMessageEmailHtml(input.message, attachments)}
      `,
      footerNote: "This is an automated notification sent from Testkart.",
    });

    await sendEmail({
      to: TEACHER_SUPPORT_TICKETS_EMAIL,
      subject: `[Support Reply #${thread.id}] ${thread.subject}`,
      html: htmlContent,
    }).catch(err => console.error("Failed to send support reply notification email:", err));

     return new Response(superjson.stringify({ ...message, attachments } satisfies OutputType));
   } catch (error) {
     return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}