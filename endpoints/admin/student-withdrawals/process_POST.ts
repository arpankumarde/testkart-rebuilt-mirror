import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./process_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../../helpers/sendEmail";
import { withdrawalProcessed } from "../../../helpers/emailTemplates";
import { getStudentAvailableBalance } from "../../../helpers/getStudentAvailableBalance";
import { lockWallet } from "../../../helpers/walletLock";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      // Row lock so two admins can't process the same request at once
      const withdrawal = await trx
        .selectFrom("studentWithdrawals")
        .where("id", "=", input.withdrawalId)
        .selectAll()
        .forUpdate()
        .executeTakeFirst();

      if (!withdrawal) {
        return { status: 404, error: "Withdrawal request not found" } as const;
      }

      if (withdrawal.status !== "pending") {
        return { status: 400, error: `Cannot process withdrawal with status '${withdrawal.status}'` } as const;
      }

      if (input.action === "approve") {
        await lockWallet(trx, withdrawal.studentId);
        // Pending requests are already deducted from the balance, so a
        // negative raw balance means this one is no longer covered.
        const { rawBalance } = await getStudentAvailableBalance(withdrawal.studentId, trx);
        if (rawBalance < 0) {
          return {
            status: 400,
            error: `The student's wallet no longer covers this withdrawal. It is short by ₹${(-rawBalance).toFixed(2)}.`,
          } as const;
        }

        const updated = await trx
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
        return { updated };
      }

      // Reject
      const updated = await trx
        .updateTable("studentWithdrawals")
        .set({
          status: "failed", // Using 'failed' for rejected requests as per schema enum
          processedDate: new Date(),
          notes: input.notes ? `${withdrawal.notes ? withdrawal.notes + '\n' : ''}Rejection Reason: ${input.notes}` : withdrawal.notes,
        })
        .where("id", "=", input.withdrawalId)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { updated };
    });

    if ("error" in result) {
      return new Response(superjson.stringify({ error: result.error }), { status: result.status });
    }

    const updatedWithdrawal = result.updated;

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
        const emailResult = await sendEmail({
          to: student.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
        if (emailResult.success) {
          console.log(`Withdrawal processed email sent to student ${student.email}`);
        } else {
          console.error(`Failed to send withdrawal processed email:`, emailResult.error);
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
