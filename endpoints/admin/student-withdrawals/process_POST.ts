import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./process_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../../helpers/sendEmail";
import { withdrawalProcessed } from "../../../helpers/emailTemplates";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Fetch the withdrawal to ensure it exists and is pending
    const withdrawal = await db
      .selectFrom("studentWithdrawals")
      .where("id", "=", input.withdrawalId)
      .selectAll()
      .executeTakeFirst();

    if (!withdrawal) {
      return new Response(
        superjson.stringify({ error: "Withdrawal request not found" }),
        { status: 404 }
      );
    }

    if (withdrawal.status !== "pending") {
      return new Response(
        superjson.stringify({ error: `Cannot process withdrawal with status '${withdrawal.status}'` }),
        { status: 400 }
      );
    }

    let updatedWithdrawal;

    if (input.action === "approve") {
      updatedWithdrawal = await db
        .updateTable("studentWithdrawals")
        .set({
          status: "completed",
          processedDate: new Date(),
          transactionId: input.transactionId,
          notes: input.notes ? input.notes : withdrawal.notes,
        })
        .where("id", "=", input.withdrawalId)
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      // Reject
      updatedWithdrawal = await db
        .updateTable("studentWithdrawals")
        .set({
          status: "failed", // Using 'failed' for rejected requests as per schema enum
          processedDate: new Date(),
          notes: input.notes ? `${withdrawal.notes ? withdrawal.notes + '\n' : ''}Rejection Reason: ${input.notes}` : withdrawal.notes,
        })
        .where("id", "=", input.withdrawalId)
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    const output: OutputType = {
      ...updatedWithdrawal,
      amount: Number(updatedWithdrawal.amount),
    };

    // Send withdrawal processed email (non-blocking)
    const student = await db
      .selectFrom("users")
      .where("id", "=", updatedWithdrawal.studentId)
      .select(["email", "displayName"])
      .executeTakeFirst();

    if (student?.email) {
      try {
        const emailTemplate = withdrawalProcessed(
          student.displayName,
          Number(updatedWithdrawal.amount),
          updatedWithdrawal.status
        );
        const result = await sendEmail({
          to: student.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
        if (result.success) {
          console.log(`Withdrawal processed email sent to student ${student.email}`);
        } else {
          console.error(`Failed to send withdrawal processed email:`, result.error);
        }
      } catch (emailError) {
        console.error(`Error sending withdrawal processed email:`, emailError);
      }
    }

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error processing student withdrawal:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}