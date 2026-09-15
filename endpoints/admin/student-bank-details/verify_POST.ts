import { schema, OutputType } from "./verify_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { sendTemplateEmail } from "../../../helpers/sendTemplateEmail";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const { bankDetailsId, action, rejectionReason } = validatedInput;
    const status = action === "verify" ? "verified" : "rejected";

    const updatedRecord = await db
      .updateTable("studentBankDetails")
      .set({
        verificationStatus: status,
        rejectionReason: status === "rejected" ? rejectionReason : null,
        updatedAt: new Date(),
      })
      .where("id", "=", bankDetailsId)
      .returningAll()
    .executeTakeFirstOrThrow();

    // Send email notification
    if (updatedRecord) {
      try {
        const student = await db
          .selectFrom("users")
          .select(["email", "displayName"])
          .where("id", "=", updatedRecord.studentId)
          .executeTakeFirst();

        if (student?.email) {
          if (status === "verified") {
            await sendTemplateEmail("student_bank_details_verified", student.email, { displayName: student.displayName });
          } else if (status === "rejected") {
            await sendTemplateEmail("student_bank_details_rejected", student.email, {
              displayName: student.displayName,
              reason: rejectionReason || "No reason provided",
            });
          }
        }
      } catch (emailError) {
        console.error("Error sending student bank details email:", emailError);
      }
    }

   return new Response(superjson.stringify(updatedRecord satisfies OutputType));
  } catch (error) {
    console.error("Error verifying student bank details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}