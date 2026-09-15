import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./request_POST.schema";
import superjson from "superjson";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { sendTemplateEmail } from "../../../helpers/sendTemplateEmail";
import { getStudentAvailableBalance } from "../../../helpers/getStudentAvailableBalance";
import { lockWallet } from "../../../helpers/walletLock";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can request withdrawals" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    if (input.amount < 50) {
      return new Response(
        superjson.stringify({ error: "Minimum withdrawal amount is ₹50" }),
        { status: 400 }
      );
    }

    // Check bank details
    const bankDetails = await db
      .selectFrom("studentBankDetails")
      .where("studentId", "=", user.id)
      .where("verificationStatus", "=", "verified")
      .select("id")
      .executeTakeFirst();

    if (!bankDetails) {
      return new Response(
        superjson.stringify({ error: "You must have a verified bank account to request a withdrawal." }),
        { status: 400 }
      );
    }

    // The balance check and the insert share the wallet lock with wallet
    // purchases, so parallel requests cannot all pass against one balance.
    const newWithdrawal = await db.transaction().execute(async (trx) => {
      await lockWallet(trx, user.id);

      const pendingWithdrawal = await trx
        .selectFrom("studentWithdrawals")
        .where("studentId", "=", user.id)
        .where("status", "=", "pending")
        .select("id")
        .executeTakeFirst();

      if (pendingWithdrawal) {
        throw new Error("You already have a pending withdrawal request.");
      }

      // Shared formula - see getStudentAvailableBalance.tsx
      const { availableBalance } = await getStudentAvailableBalance(user.id, trx);

      if (input.amount > availableBalance) {
        throw new Error(`Insufficient balance. Available to withdraw: ₹${availableBalance.toFixed(2)}`);
      }

      return trx
        .insertInto("studentWithdrawals")
        .values({
          studentId: user.id,
          amount: input.amount.toString(),
          status: "pending",
          requestedDate: new Date(),
          notes: input.notes,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });

    sendAdminNotification("student_withdrawal", {
      userName: user.displayName,
      userEmail: user.email,
      userId: user.id,
      amount: input.amount,
    });

    // Send confirmation email to student
    if (user.email) {
      sendTemplateEmail("student_withdrawal_requested", user.email, {
        displayName: user.displayName,
        amount: input.amount.toFixed(2),
      }).catch((emailError) => console.error("Error sending student withdrawal email:", emailError));
    }

    const output: OutputType = {
      ...newWithdrawal,
      amount: Number(newWithdrawal.amount),
    };

    return new Response(superjson.stringify(output), { status: 201 });
  } catch (error) {
    console.error("Error requesting student withdrawal:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
}
