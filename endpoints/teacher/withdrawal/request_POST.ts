import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./request_POST.schema";
import superjson from "superjson";
import { sendEmail } from "../../../helpers/sendEmail";
import { withdrawalRequested } from "../../../helpers/emailTemplates";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { lockWallet } from "../../../helpers/walletLock";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    // Block managers from owner-only features
    if (teacherRole === 'manager') {
      return new Response(superjson.stringify({ error: "Only account owners can access this feature" }), { status: 403 });
    }

    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can request withdrawals" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    if (input.amount < 100) {
      return new Response(
        superjson.stringify({ error: "Minimum withdrawal amount is ₹100" }),
        { status: 400 }
      );
    }

    // Check and insert under the wallet lock shared with every other teacher
    // debit, so parallel requests can't all pass against the same balance.
    const result = await db.transaction().execute(async (trx) => {
      await lockWallet(trx, effectiveTeacherId);

      // availableBalance already subtracts pending withdrawal requests
      const { availableBalance } = await getTeacherAvailableBalance(effectiveTeacherId, trx);

      console.log(
        `Teacher ${user.id} withdrawal check: withdrawable=${availableBalance}, requested=${input.amount}`
      );

      if (input.amount > availableBalance) {
        return { withdrawableAmount: availableBalance, newWithdrawal: null };
      }

      const newWithdrawal = await trx
        .insertInto("teacherWithdrawals")
        .values({
          teacherId: effectiveTeacherId,
          amount: input.amount.toString(),
          status: "pending",
          requestedDate: new Date(),
          notes: input.notes,
          balanceAtRequest: availableBalance.toString(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { withdrawableAmount: availableBalance, newWithdrawal };
    });

    const { newWithdrawal } = result;
    if (!newWithdrawal) {
      return new Response(
        superjson.stringify({
          error: `Insufficient balance. Available to withdraw: ₹${result.withdrawableAmount.toFixed(2)}`,
        }),
        { status: 400 }
      );
    }

    sendAdminNotification("teacher_withdrawal", {
      userName: user.displayName,
      userEmail: user.email,
      userId: user.id,
      amount: input.amount,
    });

    const output: OutputType = {
      ...newWithdrawal,
      amount: Number(newWithdrawal.amount),
    };

    // Send withdrawal requested email
    if (user.email) {
      try {
        const emailTemplate = withdrawalRequested(user.displayName, input.amount);
        const emailResult = await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
        if (emailResult.success) {
          console.log(`Withdrawal request email sent to ${user.email}`);
        } else {
          console.error(`Failed to send withdrawal request email:`, emailResult.error);
        }
      } catch (emailError) {
        console.error(`Error sending withdrawal request email:`, emailError);
      }
    }

    return new Response(superjson.stringify(output), { status: 201 });
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
