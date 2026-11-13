import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { cashfreeGatewayEnv, fetchCashfreeOrder, getCashfreeConfig, terminateCashfreeOrder } from "../../../helpers/cashfree";
import { openCashfreeSession, settleCashfreeOrder } from "../../../helpers/cashfreeOrders";
import {
  cancelCashfreeSubscriptionPayment,
  FAILED_SUBSCRIPTION_PAYMENT_STATUSES,
  fetchCashfreeSubscriptionPayment,
} from "../../../helpers/cashfreeSubscriptions";
import { CHECKOUT_HOLD_MINUTES } from "../../../helpers/liveLessonConfig";
import {
  completeLiveCycle,
  getLiveBalance,
  payNowOrderRef,
  payNowRefPrefix,
  roundMoney,
  settleLiveRenewal,
  studentBalanceLock,
} from "../../../helpers/livePackages";
import { sendRenewalPaidEmail } from "../../../helpers/livePackageEmails";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { schema, OutputType } from "./pay-now_POST.schema";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });
const completed = () => new Response(superjson.stringify({ kind: "completed" } satisfies OutputType));

/**
 * One-time payment for a renewal whose autopay debit failed. The failed debit is cancelled at
 * Cashfree first; an unpaid earlier "Pay now" order for the cycle is reused while its checkout is
 * open, otherwise terminated, so the cycle never has two payable orders. The cycle stays "failed"
 * until an order is paid; completeLiveCycle then makes the paying order the cycle's order.
 */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { packageId } = schema.parse(superjson.parse(await request.text()));
    const pkg = await db.selectFrom("livePackages").select(["studentId", "status"]).where("id", "=", packageId).executeTakeFirst();
    if (!pkg || pkg.studentId !== user.id) return fail("Package not found.", 404);
    if (pkg.status !== "past_due") return fail("Nothing is due on this package.");

    const cycle = await db
      .selectFrom("livePackageCycles")
      .select(["id", "amount", "graceUntil", "cycleNumber", "paymentId"])
      .where("packageId", "=", packageId)
      .where("status", "=", "failed")
      .orderBy("cycleNumber", "desc")
      .executeTakeFirst();
    if (!cycle || !cycle.graceUntil || new Date(cycle.graceUntil) < new Date()) return fail("The time to pay for this renewal has passed.");

    if (cycle.paymentId) {
      const mandate = await db
        .selectFrom("liveMandates")
        .select("subscriptionId")
        .where("packageId", "=", packageId)
        .orderBy("createdAt", "desc")
        .executeTakeFirst();
      const debit = mandate ? await fetchCashfreeSubscriptionPayment(mandate.subscriptionId, cycle.paymentId).catch(() => null) : null;
      if (mandate && debit) {
        if (debit.payment_status === "SUCCESS") {
          if ((await settleLiveRenewal(cycle.id)) === "paid") return completed();
          return fail("Your autopay debit went through and is being confirmed. Please check again in a few minutes.");
        }
        if (!FAILED_SUBSCRIPTION_PAYMENT_STATUSES.includes(debit.payment_status)) {
          try {
            await cancelCashfreeSubscriptionPayment(mandate.subscriptionId, cycle.paymentId);
          } catch {
            return fail("Your autopay debit is still being processed. Please check again in a few minutes.");
          }
        }
      }
    }

    const prefix = payNowRefPrefix(cycle.id);
    const earlier = await db
      .selectFrom("orders")
      .select(["id", "paymentTransactionId"])
      .where("userId", "=", user.id)
      .where("status", "=", "pending")
      .where("paymentMethod", "=", "cashfree")
      .where("paymentTransactionId", "like", `${prefix}%`)
      .execute();
    for (const o of earlier) {
      const ref = o.paymentTransactionId as string;
      const cf = await fetchCashfreeOrder(ref).catch(() => null);
      if (cf?.order_status === "ACTIVE" && cf.payment_session_id) {
        const session = { orderId: o.id, cashfreeOrderId: ref, paymentSessionId: cf.payment_session_id, mode: getCashfreeConfig().mode };
        return new Response(superjson.stringify({ kind: "checkout", session } satisfies OutputType));
      }
      if (cf?.order_status === "PAID" || !(await terminateCashfreeOrder(ref))) {
        const settled = await settleCashfreeOrder(o.id).catch(() => null);
        if (settled?.orderStatus === "completed") return completed();
        return fail("An earlier payment for this renewal is still being confirmed. Please check again in a few minutes.");
      }
      await db
        .updateTable("orders")
        .set({ status: "cancelled", updatedAt: new Date() })
        .where("id", "=", o.id)
        .where("status", "=", "pending")
        .execute();
    }

    const cashfreeOrderId = payNowOrderRef(cycle.id);
    const prep = await db.transaction().execute(async (trx) => {
      await studentBalanceLock(user.id).execute(trx);
      const fresh = await trx.selectFrom("livePackageCycles").select("status").where("id", "=", cycle.id).forUpdate().executeTakeFirst();
      if (fresh?.status !== "failed") throw new Error(fresh?.status === "paid" ? "This renewal is already paid." : "Nothing is due on this package.");
      const open = await trx
        .selectFrom("orders")
        .select("id")
        .where("status", "=", "pending")
        .where("paymentMethod", "=", "cashfree")
        .where("paymentTransactionId", "like", `${prefix}%`)
        .executeTakeFirst();
      if (open) throw new Error("A payment for this renewal was just started. Please try again.");

      const amount = Number(cycle.amount);
      const balance = await getLiveBalance(user.id, trx);
      const balanceUsed = roundMoney(Math.max(0, Math.min(balance, amount)));
      const toPay = roundMoney(amount - balanceUsed);
      // The balance stays held while the renewal can still be paid.
      const holdUntil = new Date(Math.max(new Date(cycle.graceUntil as Date).getTime(), Date.now() + CHECKOUT_HOLD_MINUTES * 60000));
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
          liveHoldUntil: holdUntil,
          emailsSentAt: new Date(),
          ...(toPay > 0 ? { gatewayEnv: cashfreeGatewayEnv() } : { paidAt: new Date() }),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const summary = toPay > 0 ? null : await completeLiveCycle(trx, cycle.id, null, order.id);
      return { orderId: order.id, toPay, summary };
    });

    if (prep.toPay <= 0) {
      if (prep.summary) await sendRenewalPaidEmail(prep.summary);
      return completed();
    }

    const session = await openCashfreeSession({
      orderId: prep.orderId,
      cashfreeOrderId,
      amount: prep.toPay,
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
