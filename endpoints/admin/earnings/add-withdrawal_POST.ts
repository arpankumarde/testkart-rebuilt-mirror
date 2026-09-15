import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./add-withdrawal_POST.schema";
import superjson from "superjson";
import { getTeacherAvailableBalance } from "../../../helpers/getTeacherAvailableBalance";
import { lockWallet } from "../../../helpers/walletLock";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const result = await db.transaction().execute(async (trx) => {
      await lockWallet(trx, input.teacherId);
      const { availableBalance } = await getTeacherAvailableBalance(input.teacherId, trx);

      if (input.amount > availableBalance) {
        return { availableBalance, newWithdrawal: null };
      }

      const newWithdrawal = await trx
        .insertInto("teacherWithdrawals")
        .values({
          teacherId: input.teacherId,
          amount: input.amount.toString(),
          status: "completed",
          processedDate: new Date(),
          transactionId: input.transactionId,
          notes: input.notes,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { availableBalance, newWithdrawal };
    });

    const { availableBalance, newWithdrawal } = result;
    if (!newWithdrawal) {
      return new Response(
        superjson.stringify({
          error: `Withdrawal amount of ${input.amount} exceeds available balance of ${availableBalance.toFixed(2)}.`,
        }),
        { status: 400 }
      );
    }

    console.log(`Admin recorded withdrawal of ${input.amount} for teacher ${input.teacherId}. Previous available balance: ${availableBalance.toFixed(2)}`);

    const output: OutputType = {
      ...newWithdrawal,
      amount: parseFloat(newWithdrawal.amount),
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    console.error("Error adding withdrawal:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    const status =
      error instanceof Error && error.message === "Teacher not found" ? 404 : 500;
    return new Response(superjson.stringify({ error: errorMessage }), {
      status,
    });
  }
}
