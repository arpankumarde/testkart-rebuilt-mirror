import { schema, OutputType } from "./verify_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { sendTemplateEmail } from "../../../helpers/sendTemplateEmail";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const { teacherId, status, rejectionReason } = validatedInput;

    const updatedRecord = await db
      .updateTable("teacherBankDetails")
      .set({
        verificationStatus: status,
        rejectionReason: status === "rejected" ? rejectionReason : null,
        updatedAt: new Date(),
      })
      .where("teacherId", "=", teacherId)
      .returningAll()
    .executeTakeFirstOrThrow();

    // Send email notification
    if (updatedRecord) {
      try {
        const teacher = await db.selectFrom("users")
          .select(["email", "displayName"])
          .where("id", "=", teacherId)
          .executeTakeFirst();
          
        if (teacher?.email) {
          if (status === "verified") {
            await sendTemplateEmail("bank_details_verified", teacher.email, { displayName: teacher.displayName });
          } else if (status === "rejected") {
            await sendTemplateEmail("bank_details_rejected", teacher.email, {
              displayName: teacher.displayName,
              reason: rejectionReason || "No reason provided",
            });
          }
        }
      } catch (emailError) {
        console.error("Error sending teacher bank details email:", emailError);
      }
    }

   return new Response(superjson.stringify(updatedRecord satisfies OutputType));
  } catch (error) {
    console.error("Error verifying teacher bank details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}