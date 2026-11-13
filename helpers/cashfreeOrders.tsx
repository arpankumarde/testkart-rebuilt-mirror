import { db } from "./db";
import type { OrderStatus } from "./schema";
import { ensureOrderCompletionSideEffects } from "./ensureOrderCompletionSideEffects";
import {
  cashfreeModeCode,
  createCashfreeOrder,
  fetchCashfreeOrder,
  fetchCashfreePayments,
  type CashfreePayment,
} from "./cashfree";
import type { CashfreeCheckoutSession } from "./cashfreeCheckout";
import { refundUnfulfilledCashfreeOrder } from "./liveCourseServer";

export type CashfreeSettleResult = {
  orderId: number;
  orderStatus: OrderStatus;
  message: string;
};

const DEAD_ORDER_STATUSES = ["EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"];
const FAILED_PAYMENT_STATUSES = ["FAILED", "USER_DROPPED", "CANCELLED", "VOID"];

const LATE_PAYMENT_REFUNDED = "This payment came in after the order was closed, so it is being refunded in full.";
const UNFULFILLED_PAYMENT_REFUNDED =
  "This payment could not be used (you already have this course, or it closed), so it is being refunded in full.";

const describeFailure = (payment: CashfreePayment): string =>
  payment.error_details?.error_description ||
  payment.error_details?.error_reason ||
  payment.payment_message ||
  "The payment was not completed.";

/**
 * Brings one of our Cashfree orders in line with what Cashfree reports. Used by both the
 * student's return from checkout and Cashfree's webhook, so neither has to be trusted on
 * its own: the state is always re-read from Cashfree's API. Safe to call repeatedly.
 */
export async function settleCashfreeOrder(orderId: number): Promise<CashfreeSettleResult> {
  const order = await db
    .selectFrom("orders")
    .select(["id", "status", "paymentMethod", "paymentTransactionId", "totalAmount"])
    .where("id", "=", orderId)
    .executeTakeFirst();

  if (!order) throw new Error("Order not found.");
  if (order.paymentMethod !== "cashfree" || !order.paymentTransactionId) {
    throw new Error("This order was not paid through Cashfree.");
  }

  if (order.status === "completed") {
    await ensureOrderCompletionSideEffects(order.id);
    const after = await db.selectFrom("orders").select("status").where("id", "=", order.id).executeTakeFirst();
    if (after?.status === "refunded") {
      return { orderId: order.id, orderStatus: "refunded", message: UNFULFILLED_PAYMENT_REFUNDED };
    }
    return { orderId: order.id, orderStatus: "completed", message: "Order already completed." };
  }
  if (order.status === "refunded") {
    return { orderId: order.id, orderStatus: "refunded", message: "This order was refunded." };
  }

  const cashfreeOrderId = order.paymentTransactionId;
  const [cashfreeOrder, payments] = await Promise.all([
    fetchCashfreeOrder(cashfreeOrderId),
    fetchCashfreePayments(cashfreeOrderId),
  ]);

  const successfulPayment = payments.find((p) => p.payment_status === "SUCCESS");

  if (cashfreeOrder.order_status === "PAID" && successfulPayment) {
    // Paid after we closed the order (replaced by a newer checkout, expired, or marked failed): the
    // slot, seat or cycle may be gone or bought again, so the money goes back instead.
    if (order.status === "cancelled" || order.status === "failed") {
      const refunded = await refundUnfulfilledCashfreeOrder({
        orderId: order.id,
        reason: `Paid after the order was ${order.status}.`,
        amount: Number(cashfreeOrder.order_amount),
      });
      return refunded
        ? { orderId: order.id, orderStatus: "refunded", message: LATE_PAYMENT_REFUNDED }
        : { orderId: order.id, orderStatus: order.status, message: "This payment came in after the order was closed. Support will refund it." };
    }

    if (Math.abs(Number(cashfreeOrder.order_amount) - Number(order.totalAmount)) > 0.009) {
      console.error(
        `[Cashfree] Amount mismatch on order ${order.id}: Cashfree ${cashfreeOrder.order_amount}, ours ${order.totalAmount}. Not completing.`
      );
      return {
        orderId: order.id,
        orderStatus: order.status,
        message: "The paid amount does not match this order. Please contact support.",
      };
    }

    await db
      .updateTable("orders")
      .set({
        status: "completed",
        paymentMode: cashfreeModeCode(successfulPayment.payment_group),
        paymentGatewayStatus: "SUCCESS",
        paymentErrorCode: null,
        paymentErrorMessage: null,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where("id", "=", order.id)
      .where("status", "=", "pending")
      .execute();

    await ensureOrderCompletionSideEffects(order.id);
    const after = await db.selectFrom("orders").select("status").where("id", "=", order.id).executeTakeFirst();
    if (after?.status === "refunded") {
      return { orderId: order.id, orderStatus: "refunded", message: UNFULFILLED_PAYMENT_REFUNDED };
    }
    if (after?.status !== "completed") {
      // A parallel settle closed the order between our read and the update; settle again from that state.
      return settleCashfreeOrder(order.id);
    }
    return { orderId: order.id, orderStatus: "completed", message: "Payment verified and order completed." };
  }

  const failedPayment = [...payments].reverse().find((p) => FAILED_PAYMENT_STATUSES.includes(p.payment_status));

  if (DEAD_ORDER_STATUSES.includes(cashfreeOrder.order_status)) {
    await db
      .updateTable("orders")
      .set({
        status: "failed",
        paymentGatewayStatus: cashfreeOrder.order_status,
        paymentErrorCode: failedPayment?.error_details?.error_code ?? null,
        paymentErrorMessage: failedPayment ? describeFailure(failedPayment) : "The payment session expired.",
        updatedAt: new Date(),
      })
      .where("id", "=", order.id)
      .where("status", "=", "pending")
      .execute();
    return {
      orderId: order.id,
      orderStatus: "failed",
      message: failedPayment ? describeFailure(failedPayment) : "The payment session expired.",
    };
  }

  if (failedPayment) {
    await db
      .updateTable("orders")
      .set({
        paymentGatewayStatus: failedPayment.payment_status,
        paymentErrorCode: failedPayment.error_details?.error_code ?? null,
        paymentErrorMessage: describeFailure(failedPayment),
        updatedAt: new Date(),
      })
      .where("id", "=", order.id)
      .where("status", "=", "pending")
      .execute();
    return { orderId: order.id, orderStatus: "failed", message: describeFailure(failedPayment) };
  }

  return { orderId: order.id, orderStatus: "pending", message: "The payment is still being confirmed." };
}

const SITE_ORIGIN = "https://testkart.in";

type CheckoutUser = {
  id: number;
  displayName?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
};

/**
 * Opens the Cashfree payment session for an order that was just inserted as pending. Called
 * after the order's transaction has committed, so no database connection is held during the
 * network call. If Cashfree refuses, the order is marked failed so it cannot linger as pending.
 */
export async function openCashfreeSession(args: {
  orderId: number;
  cashfreeOrderId: string;
  amount: number;
  user: CheckoutUser;
  /** Where Cashfree sends the student afterwards; ?order_id=...&gateway=cashfree is added. */
  returnPath: string;
  note: string;
}): Promise<CashfreeCheckoutSession> {
  const phone = (args.user.mobileNumber ?? "").replace(/\D/g, "").slice(-10);
  const customerPhone = phone.length === 10 ? phone : "9999999999";
  const customerEmail = args.user.email ?? `${customerPhone}@mail.testkart.in`;
  const returnUrl = `${SITE_ORIGIN}${args.returnPath}?order_id=${args.orderId}&gateway=cashfree`;

  try {
    const session = await createCashfreeOrder({
      cashfreeOrderId: args.cashfreeOrderId,
      amount: args.amount,
      customerId: args.user.id,
      customerName: args.user.displayName || "Student",
      customerEmail,
      customerPhone,
      returnUrl,
      notifyUrl: `${SITE_ORIGIN}/_api/payment/cashfree/webhook`,
      note: args.note,
    });
    return {
      orderId: args.orderId,
      cashfreeOrderId: args.cashfreeOrderId,
      paymentSessionId: session.paymentSessionId,
      mode: session.mode,
    };
  } catch (error) {
    await db
      .updateTable("orders")
      .set({
        status: "failed",
        paymentGatewayStatus: "CREATE_FAILED",
        paymentErrorMessage: error instanceof Error ? error.message.slice(0, 300) : "Could not start the payment.",
        updatedAt: new Date(),
      })
      .where("id", "=", args.orderId)
      .where("status", "=", "pending")
      .execute();
    throw error;
  }
}
