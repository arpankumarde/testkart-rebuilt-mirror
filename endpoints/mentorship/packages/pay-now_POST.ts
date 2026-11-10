import superjson from "superjson";
import { nanoid } from "nanoid";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getCashfreeConfig } from "../../../helpers/cashfree";
import { openCashfreeSession } from "../../../helpers/cashfreeOrders";
import { CHECKOUT_HOLD_MINUTES } from "../../../helpers/liveLessonConfig";
import { completeLiveCycle, getLiveBalance, roundMoney } from "../../../helpers/livePackages";
import { sendRenewalPaidEmail } from "../../../helpers/livePackageEmails";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { schema, OutputType } from "./pay-now_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { packageId } = schema.parse(superjson.parse(await request.text()));
    const pkg = await db.selectFrom("livePackages").select(["studentId", "status"]).where("id", "=", packageId).executeTakeFirst();
    if (!pkg || pkg.studentId !== user.id) return fail("Package not found.", 404);
    if (pkg.status !== "past_due") return fail("Nothing is due on this package.");

    const cycle = await db
      .selectFrom("livePackageCycles")
      .select(["id", "amount", "graceUntil", "cycleNumber"])
      .where("packageId", "=", packageId)
      .where("status", "=", "failed")
      .orderBy("cycleNumber", "desc")
      .executeTakeFirst();
    if (!cycle || !cycle.graceUntil || new Date(cycle.graceUntil) < new Date()) return fail("The time to pay for this renewal has passed.");

    const amount = Number(cycle.amount);
    const balance = await getLiveBalance(user.id);
    const balanceUsed = roundMoney(Math.max(0, Math.min(balance, amount)));
    const toPay = roundMoney(amount - balanceUsed);
    if (toPay > 0) getCashfreeConfig();
    const cashfreeOrderId = `livepkg-${nanoid(16)}`;

    const prep = await db.transaction().execute(async (trx) => {
      const order = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          ...getOrderClientInfo(request),
          totalAmount: toPay.toFixed(2),
          status: toPay > 0 ? "pending" : "completed",
          paymentMethod: toPay > 0 ? "cashfree" : "live_balance",
          paymentTransactionId: cashfreeOrderId,
          liveBalanceUsed: balanceUsed.toFixed(2),
          liveHoldUntil: new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60000),
          emailsSentAt: new Date(),
          ...(toPay > 0 ? {} : { paidAt: new Date() }),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      // The cycle stays "failed" (and inside its grace period) until this order is paid.
      await trx.updateTable("livePackageCycles").set({ orderId: order.id, updatedAt: new Date() }).where("id", "=", cycle.id).execute();
      const summary = toPay > 0 ? null : await completeLiveCycle(trx, cycle.id);
      return { orderId: order.id, summary };
    });

    if (toPay <= 0) {
      if (prep.summary) await sendRenewalPaidEmail(prep.summary);
      return new Response(superjson.stringify({ kind: "completed" } satisfies OutputType));
    }

    const session = await openCashfreeSession({
      orderId: prep.orderId,
      cashfreeOrderId,
      amount: toPay,
      user,
      returnPath: "/student/live-teaching",
      note: `Live classes, cycle ${cycle.cycleNumber}`,
    });
    return new Response(superjson.stringify({ kind: "checkout", session } satisfies OutputType));
  } catch (error) {
    console.error("Package pay-now failed:", error);
    return fail(error instanceof Error ? error.message : "Could not start the payment.");
  }
}
