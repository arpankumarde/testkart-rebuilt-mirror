import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./request_POST.schema";
import superjson from "superjson";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { sendTemplateEmail } from "../../../helpers/sendTemplateEmail";
import { getStudentAvailableBalance } from "../../../helpers/getStudentAvailableBalance";

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

    // Calculate Available Balance (shared formula — see getStudentAvailableBalance.tsx)
    const { availableBalance } = await getStudentAvailableBalance(user.id);

    if (input.amount > availableBalance) {
      return new Response(
        superjson.stringify({
          error: `Insufficient balance. Available to withdraw: ₹${availableBalance.toFixed(2)}`,
        }),
        { status: 400 }
      );
    }

    // Check if there's already a pending withdrawal
    const pendingWithdrawal = await db
      .selectFrom("studentWithdrawals")
      .where("studentId", "=", user.id)
      .where("status", "=", "pending")
      .select("id")
      .executeTakeFirst();

    if (pendingWithdrawal) {
      return new Response(
        superjson.stringify({ error: "You already have a pending withdrawal request." }),
        { status: 400 }
      );
    }

    // Create Request
    const newWithdrawal = await db
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