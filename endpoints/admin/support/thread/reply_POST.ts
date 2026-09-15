import { schema, OutputType } from "./reply_POST.schema";
import superjson from 'superjson';
 import { db } from "../../../../helpers/db";
 import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
 import { sendTemplateEmail } from "../../../../helpers/sendTemplateEmail";
import { sendEmail } from "../../../../helpers/sendEmail";
import { getBrandedEmailHtml } from "../../../../helpers/emailBaseTemplate";

const TEACHER_SUPPORT_TICKETS_EMAIL = "teacher-support-tickets@testkart.in";
 
 export async function handle(request: Request) {
   try {
     const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const thread = await db.selectFrom("supportThreads")
      .where("id", "=", input.threadId)
      .selectAll()
      .executeTakeFirst();

    if (!thread) {
      return new Response(superjson.stringify({ error: "Thread not found" }), { status: 404 });
    }

    const message = await db.transaction().execute(async (trx) => {
      const newMessage = await trx.insertInto("supportMessages")
        .values({
          threadId: thread.id,
          senderType: "admin",
          senderId: admin.id,
          messageText: input.message,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx.updateTable("supportThreads")
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where("id", "=", thread.id)
        .execute();

       return newMessage;
     });
 
        // Send notification to teacher
    if (thread.teacherId) {
      const teacher = await db.selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", thread.teacherId)
        .executeTakeFirst();

      if (teacher?.email) {
        await sendTemplateEmail("support_reply_to_teacher", teacher.email, {
          teacherName: teacher.displayName,
          subject: thread.subject,
        }).catch((err) => console.error("Failed to send support reply email:", err));
      }
    }

    const replyTimestamp = new Date().toISOString();

    const htmlContent = getBrandedEmailHtml({
      title: "Admin Replied to Support Ticket",
      icon: "💬",
      accent: "info",
      heading: "Admin Replied to Support Ticket",
      subheading: `Ticket #${thread.id} · ${thread.subject}`,
      table: [
        { label: "Replied By", value: "Admin" },
        { label: "Timestamp", value: replyTimestamp },
      ],
      bodyHtml: `
        <p style="margin:0 0 8px;font-weight:600;">Reply Message</p>
        <div style="background-color:#ffffff;border:1px solid #E5E7EB;padding:16px;border-radius:8px;">${input.message.replace(/\n/g, '<br>')}</div>
      `,
      footerNote: "This is an automated notification sent from Testkart.",
    });

    await sendEmail({
      to: TEACHER_SUPPORT_TICKETS_EMAIL,
      subject: `[Admin Reply #${thread.id}] ${thread.subject}`,
      html: htmlContent,
    }).catch(err => console.error("Failed to send admin support reply notification email:", err));

     return new Response(superjson.stringify(message satisfies OutputType));
   } catch (error) {
     return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}