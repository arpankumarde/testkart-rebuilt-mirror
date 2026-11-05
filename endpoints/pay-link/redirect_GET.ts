import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { db } from "../../helpers/db";
import { PAYU_MODE } from "../../helpers/_publicConfigs";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../helpers/getTeacherPlatformFee";
import { getOrderClientInfo } from "../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import {
  cartRowKey,
  checkoutLines,
  orderCouponColumns,
  orderItemDiscount,
  priceCartForCheckout,
  recordCouponUsages,
} from "../../helpers/cartCouponStackServer";
import {
  PAY_LINK_MAX_AMOUNT,
  PAY_LINK_UDF,
  findPaidOrder,
  findPayRequest,
  loadPayableRows,
  parsePayLinkItems,
  payLinkMessageHtml,
  payableRowPrice,
  payuAutoPostHtml,
} from "../../helpers/payLinkServer";
import { schema } from "./redirect_GET.schema";

const html = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

/**
 * Public: starts a PayU payment for a payment link. The order belongs to the
 * student; udf2 marks it so the PayU callback does not sign the payer in.
 */
export async function handle(request: Request): Promise<Response> {
  const baseUrl = "https://testkart.in";
  const url = new URL(request.url);
  const parsed = schema.safeParse({ token: url.searchParams.get("token") ?? "" });
  const backUrl = parsed.success ? `${baseUrl}/pay/${encodeURIComponent(parsed.data.token)}` : baseUrl;

  try {
    if (!parsed.success) return html(payLinkMessageHtml("Link not valid", "This payment link is not valid. Ask for a new one.", baseUrl), 400);
    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      return html(payLinkMessageHtml("Payments are unavailable", "Payments are not available right now. Please try again later.", backUrl), 500);
    }

    const payRequest = await findPayRequest(db, parsed.data.token);
    if (!payRequest) return html(payLinkMessageHtml("Link not valid", "This payment link is not valid. Ask for a new one.", baseUrl), 404);
    if (await findPaidOrder(db, payRequest.id)) {
      return html(payLinkMessageHtml("Already paid", "This order has already been paid. Thank you.", backUrl));
    }
    if (payRequest.expiresAt.getTime() < Date.now()) {
      return html(payLinkMessageHtml("Link expired", "This payment link has expired. Ask for a new one.", backUrl), 410);
    }

    const student = await db
      .selectFrom("users")
      .select(["id", "displayName", "email", "mobileNumber", "isActive"])
      .where("id", "=", payRequest.userId)
      .executeTakeFirst();
    if (!student || student.isActive === false) {
      return html(payLinkMessageHtml("Link not valid", "This payment link can no longer be used.", baseUrl), 410);
    }

    const items = parsePayLinkItems(payRequest.items);
    const result = await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("orders")
        .set({ status: "cancelled" })
        .where("payRequestId", "=", payRequest.id)
        .where("status", "=", "pending")
        .execute();

      const rows = await loadPayableRows(trx, student.id, items);
      if (rows.length === 0) throw new Error("There is nothing left to pay for on this link.");

      const listTotal = rows.reduce((sum, r) => sum + payableRowPrice(r), 0);
      const { stack } = await priceCartForCheckout(trx, { userId: student.id, lines: checkoutLines(rows), chosen: null, useTcoins: false });
      const finalAmount = Math.round(Math.max(0, listTotal - stack.discountAmount) * 100) / 100;
      if (finalAmount <= 0) throw new Error("There is nothing to pay on this link.");
      if (finalAmount > PAY_LINK_MAX_AMOUNT) throw new Error("This link is over the payment link limit. Ask for a smaller one.");

      const feeCache = new Map<number, number>();
      const feeFor = async (teacherId: number | null) => {
        if (!teacherId) return DEFAULT_TEACHER_PLATFORM_FEE;
        if (!feeCache.has(teacherId)) feeCache.set(teacherId, await getTeacherPlatformFee(teacherId, trx));
        return feeCache.get(teacherId)!;
      };

      const txnid = `testkart-${nanoid(12)}`;
      const order = await trx
        .insertInto("orders")
        .values({
          userId: student.id,
          ...getOrderClientInfo(request),
          ...getOrderAttribution(request),
          lastTouchSource: "pay_link",
          payRequestId: payRequest.id,
          totalAmount: finalAmount.toFixed(2),
          ...orderCouponColumns(stack),
          status: "pending",
          paymentMethod: "payu",
          paymentTransactionId: txnid,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const orderItems = await Promise.all(
        rows.map(async (row) => ({
          orderId: order.id,
          mockTestId: row.mockTestId,
          courseId: row.courseId,
          digitalProductId: row.digitalProductId,
          priceAtPurchase: payableRowPrice(row).toFixed(2),
          ...orderItemDiscount(stack, cartRowKey(row)),
          platformFeePercentage: (await feeFor(row.testTeacherId ?? row.courseTeacherId ?? row.digitalProductTeacherId)).toFixed(2),
        }))
      );
      await trx.insertInto("orderItems").values(orderItems).execute();
      await recordCouponUsages(trx, stack, student.id, order.id);

      const amount = finalAmount.toFixed(2);
      const productinfo = rows.map((r) => r.title).join(", ").replace(/\|/g, " ").substring(0, 100);
      const firstname = (student.displayName || "Student").replace(/\|/g, " ");
      const email = student.email ?? `${student.mobileNumber}@mail.testkart.in`;
      const udf2 = PAY_LINK_UDF;
      const hash = createHash("sha512")
        .update([PAYU_MERCHANT_KEY, txnid, amount, productinfo, firstname, email, "", udf2, "", "", "", "", "", "", "", "", PAYU_MERCHANT_SALT].join("|"))
        .digest("hex");

      return {
        orderId: order.id,
        amount,
        fields: {
          key: PAYU_MERCHANT_KEY,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          phone: student.mobileNumber || "9999999999",
          udf2,
          surl: `${baseUrl}/_api/payment/payu/callback`,
          furl: `${baseUrl}/_api/payment/payu/callback`,
          hash,
        },
      };
    });

    await recordFunnelEvent({
      event: "checkout_started",
      request,
      userId: student.id,
      orderId: result.orderId,
      amount: result.amount,
      entityType: "pay_request",
      entityId: payRequest.id,
      props: { path: "pay_link" },
    });

    const payuUrl = PAYU_MODE !== "production" ? "https://test.payu.in/_payment" : "https://secure.payu.in/_payment";
    return html(payuAutoPostHtml(payuUrl, result.fields));
  } catch (error) {
    console.error("[pay-link/redirect] failed:", error);
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return html(payLinkMessageHtml("Could not start the payment", message, backUrl), 400);
  }
}
