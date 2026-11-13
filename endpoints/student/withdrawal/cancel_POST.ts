import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { sendAdminNotification } from "../../../helpers/sendAdminNotification";
import {
  cancelPendingWithdrawal,
  WithdrawalCancelError,
  withdrawalUserActor,
} from "../../../helpers/withdrawalCancelServer";
import { schema, OutputType } from "./cancel_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, impersonatorAdminId } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students can cancel these withdrawals" }), { status: 403 });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const cancelled = await cancelPendingWithdrawal(
      "student",
      input.withdrawalId,
      user.id,
      withdrawalUserActor(user.id, impersonatorAdminId)
    );

    sendAdminNotification("student_withdrawal_cancelled", {
      userName: user.displayName,
      userEmail: user.email,
      userId: user.id,
      amount: Number(cancelled.amount),
    });

    const output: OutputType = { ...cancelled, amount: Number(cancelled.amount) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof WithdrawalCancelError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error cancelling student withdrawal:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
}