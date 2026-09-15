import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./request_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { sendEmail } from "../../../helpers/sendEmail";
import { withdrawalRequested } from "../../../helpers/emailTemplates";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";

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

    // 1. Get full balance breakdown using the shared helper (counts only completed withdrawals)
    const balanceBreakdown = await getTeacherAvailableBalance(effectiveTeacherId);

    // 2. Additionally subtract pending withdrawals (locked funds not yet processed)
    const pendingWithdrawalsResult = await db
      .selectFrom("teacherWithdrawals")
      .where("teacherId", "=", effectiveTeacherId)
      .where("status", "=", "pending")
      .select([
        sql<string>`sum(amount)`.as("totalAmount"),
      ])
      .executeTakeFirst();

    const totalPending = Number(pendingWithdrawalsResult?.totalAmount || 0);

    // 3. Actual withdrawable amount = helper's availableBalance minus any pending (locked) withdrawals
    const withdrawableAmount = Math.max(0, Math.round((balanceBreakdown.availableBalance - totalPending) * 100) / 100);

    console.log(
      `Teacher ${user.id} withdrawal check: availableBalance=${balanceBreakdown.availableBalance}, pendingLocked=${totalPending}, withdrawable=${withdrawableAmount}, requested=${input.amount}`
    );

    if (input.amount > withdrawableAmount) {
      return new Response(
        superjson.stringify({
          error: `Insufficient balance. Available to withdraw: ₹${withdrawableAmount.toFixed(2)}`,
        }),
        { status: 400 }
      );
    }

    // 4. Create Withdrawal Request
    const newWithdrawal = await db
      .insertInto("teacherWithdrawals")
      .values({
        teacherId: effectiveTeacherId,
        amount: input.amount.toString(),
        status: "pending",
        requestedDate: new Date(),
        notes: input.notes,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

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
        const result = await sendEmail({
          to: user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
        if (result.success) {
          console.log(`Withdrawal request email sent to ${user.email}`);
        } else {
          console.error(`Failed to send withdrawal request email:`, result.error);
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