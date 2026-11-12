import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, type OutputType, type PayuFormFields } from "./retry-payment_POST.schema";
import superjson from "superjson";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import type { Selectable, Transaction, Updateable } from "kysely";
import type { DB, Orders } from "../../helpers/schema";
import { PAYU_MODE } from "../../helpers/_publicConfigs";
import { verifyPayUPayment } from "../../helpers/verifyPayUPayment";
import { courseEffectivePriceSql } from "../../helpers/coursePricing";
import { productEffectivePriceSql } from "../../helpers/digitalProductPricing";
import { liveTestEffectivePrice } from "../../helpers/liveTestPricing";
import { getTeacherPlatformFee, DEFAULT_TEACHER_PLATFORM_FEE } from "../../helpers/getTeacherPlatformFee";
import {
  cartRowKey,
  checkoutLines,
  orderCouponColumns,
  orderItemDiscount,
  priceCartForCheckout,
  recordCouponUsages,
  type CartCouponPricing,
} from "../../helpers/cartCouponStackServer";
import { recordSpinRedemption } from "../../helpers/spinWinServer";
import { planTcoinsForOrder } from "../../helpers/tcoins";
import { expiredPurchaseError } from "../../helpers/contentExpiryServer";
import { validateBundlePromo, recordBundlePromoUsage, type BundlePromoResult } from "../../helpers/bundlePromoServer";
import { sanitizePayuText } from "../../helpers/sanitizePayuText";
import { recordFunnelEvent } from "../../helpers/recordFunnelEvent";
import {
  directRetryKind,
  liveTestIdFromTxnid,
  recordPaymentAttempt,
  type DirectRetryKind,
} from "../../helpers/orderPaymentAttempts";

/*
 * Pays a failed order again without rebuilding it from the cart. The order keeps its id and items;
 * prices, coupons and Tcoins are checked again as a fresh checkout would, and PayU gets a new txnid.
 * The PayU callback, verify-and-complete and verify-pending then settle it like any pending order.
 */

class RetryRefusal extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

class AmountChanged extends Error {
  constructor(readonly orderId: number, readonly previousAmount: number, readonly newAmount: number, readonly notes: string[]) {
    super("The order amount has changed.");
  }
}

type OrderRow = Selectable<Orders>;

type Priced = {
  total: number;
  productInfo: string;
  notes: string[];
  orderColumns: Updateable<Orders>;
  write: () => Promise<void>;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const differs = (a: number, b: number) => Math.abs(a - b) >= 0.01;
const errorText = (error: unknown) => (error instanceof Error ? error.message : "It can no longer be used.");

async function platformFeeLookup(trx: Transaction<DB>) {
  const cache = new Map<number, number>();
  return async (teacherId: number | null | undefined): Promise<number> => {
    if (!teacherId) return DEFAULT_TEACHER_PLATFORM_FEE;
    if (!cache.has(teacherId)) cache.set(teacherId, await getTeacherPlatformFee(teacherId, trx));
    return cache.get(teacherId)!;
  };
}

async function priceCartOrder(trx: Transaction<DB>, order: OrderRow, userId: number): Promise<Priced> {
  const rows = await trx
    .selectFrom("orderItems")
    .leftJoin("mockTests", "orderItems.mockTestId", "mockTests.id")
    .leftJoin("courses", "orderItems.courseId", "courses.id")
    .leftJoin("digitalProducts", "orderItems.digitalProductId", "digitalProducts.id")
    .where("orderItems.orderId", "=", order.id)
    .select([
      "orderItems.id as orderItemId",
      "orderItems.priceAtPurchase",
      "orderItems.mockTestId",
      "orderItems.courseId",
      "orderItems.digitalProductId",
      "mockTests.title as testTitle",
      "mockTests.price as testPrice",
      "mockTests.discountPrice as testDiscountPrice",
      "mockTests.teacherId as testTeacherId",
      "mockTests.isPublished as testPublished",
      "mockTests.deletedAt as testDeletedAt",
      "courses.title as courseTitle",
      courseEffectivePriceSql.as("coursePrice"),
      "courses.teacherId as courseTeacherId",
      "courses.status as courseStatus",
      "digitalProducts.title as digitalProductTitle",
      productEffectivePriceSql.as("digitalProductPrice"),
      "digitalProducts.teacherId as digitalProductTeacherId",
      "digitalProducts.status as digitalProductStatus",
    ])
    .execute();

  if (rows.length === 0) throw new RetryRefusal("This order has no items to pay for.");

  for (const row of rows) {
    if (row.mockTestId) {
      const title = row.testTitle ?? "A test in this order";
      if (!row.testPublished || row.testDeletedAt) throw new RetryRefusal(`"${title}" is no longer available, so this order cannot be paid.`);
      const expired = await expiredPurchaseError(trx, "mock_test", row.mockTestId);
      if (expired) throw new RetryRefusal(expired);
      const owned = await trx
        .selectFrom("mockTestEnrollments")
        .select("id")
        .where("studentId", "=", userId)
        .where("mockTestId", "=", row.mockTestId)
        .executeTakeFirst();
      if (owned) throw new RetryRefusal(`You already own "${title}". Add the other items to your cart instead.`);
    } else if (row.courseId) {
      const title = row.courseTitle ?? "A course in this order";
      if (row.courseStatus !== "published") throw new RetryRefusal(`"${title}" is no longer available, so this order cannot be paid.`);
      const expired = await expiredPurchaseError(trx, "course", row.courseId);
      if (expired) throw new RetryRefusal(expired);
      const owned = await trx
        .selectFrom("courseEnrollments")
        .select("id")
        .where("studentId", "=", userId)
        .where("courseId", "=", row.courseId)
        .executeTakeFirst();
      if (owned) throw new RetryRefusal(`You are already enrolled in "${title}". Add the other items to your cart instead.`);
    } else if (row.digitalProductId) {
      const title = row.digitalProductTitle ?? "A study note in this order";
      if (row.digitalProductStatus !== "published") throw new RetryRefusal(`"${title}" is no longer available, so this order cannot be paid.`);
      const expired = await expiredPurchaseError(trx, "digital_product", row.digitalProductId);
      if (expired) throw new RetryRefusal(expired);
      const owned = await trx
        .selectFrom("digitalProductPurchases")
        .innerJoin("orders", "orders.id", "digitalProductPurchases.orderId")
        .select("digitalProductPurchases.id")
        .where("digitalProductPurchases.studentId", "=", userId)
        .where("digitalProductPurchases.productId", "=", row.digitalProductId)
        .where("orders.status", "=", "completed")
        .executeTakeFirst();
      if (owned) throw new RetryRefusal(`You already own "${title}". Add the other items to your cart instead.`);
    }
  }

  // Priced exactly as the cart checkout prices them.
  const rowPrice = (row: (typeof rows)[number]) =>
    row.mockTestId
      ? parseFloat(String(row.testDiscountPrice ?? row.testPrice ?? 0))
      : row.courseId
        ? parseFloat(String(row.coursePrice ?? 0))
        : parseFloat(String(row.digitalProductPrice ?? 0));

  const notes: string[] = [];
  if (rows.some((row) => differs(rowPrice(row), Number(row.priceAtPurchase)))) {
    notes.push("Some item prices have changed since you placed this order.");
  }

  const lines = checkoutLines(rows);
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.price, 0));
  const useTcoins = order.tcoinsRedeemed > 0;
  // promoAutoApplied is false when the student picked the coupon; teacher offers are found again by pricing.
  const chosenId = order.promoAutoApplied !== true ? order.promoCodeId : null;

  let pricing: CartCouponPricing;
  try {
    pricing = await priceCartForCheckout(trx, {
      userId,
      lines,
      chosen: chosenId ? { promoCodeId: chosenId } : null,
      useTcoins,
    });
  } catch (error) {
    if (!chosenId) throw error;
    notes.push(`Your coupon could not be applied again: ${errorText(error)}`);
    pricing = await priceCartForCheckout(trx, { userId, lines, chosen: null, useTcoins });
  }
  const { stack, spinApplied } = pricing;
  const coupons = orderCouponColumns(stack);

  const tcoins = await planTcoinsForOrder(trx, {
    userId,
    orderValue: subtotal,
    amountBeforeTcoins: Math.max(0, subtotal - stack.discountAmount),
    useTcoins,
    hasCoupon: coupons.promoCodeId !== null,
  });
  if (useTcoins && tcoins.tcoinsRedeemed < order.tcoinsRedeemed) {
    notes.push("Fewer Tcoins are available than when you placed this order.");
  }

  const productInfo = rows
    .map((row) => (row.mockTestId ? row.testTitle : row.courseId ? row.courseTitle : row.digitalProductTitle))
    .filter(Boolean)
    .join(", ")
    .substring(0, 100);

  return {
    total: tcoins.amountToPay,
    productInfo,
    notes,
    orderColumns: {
      ...coupons,
      tcoinsRedeemed: tcoins.tcoinsRedeemed,
      tcoinsCashback: tcoins.tcoinsCashback,
      tcoinsCashbackExpiresAt: tcoins.tcoinsCashbackExpiresAt,
    },
    write: async () => {
      const feeFor = await platformFeeLookup(trx);
      for (const row of rows) {
        const teacherId = row.mockTestId ? row.testTeacherId : row.courseId ? row.courseTeacherId : row.digitalProductTeacherId;
        await trx
          .updateTable("orderItems")
          .set({
            priceAtPurchase: rowPrice(row).toFixed(2),
            ...orderItemDiscount(stack, cartRowKey(row)),
            platformFeePercentage: (await feeFor(teacherId)).toFixed(2),
          })
          .where("id", "=", row.orderItemId)
          .execute();
      }
      await trx.deleteFrom("promoCodeUsages").where("orderId", "=", order.id).execute();
      await recordCouponUsages(trx, stack, userId, order.id);
      await trx.deleteFrom("spinCouponRedemptions").where("orderId", "=", order.id).execute();
      if (spinApplied) {
        await recordSpinRedemption(trx, spinApplied, { id: order.id, userId, finalAmount: tcoins.amountToPay, paymentMethod: "payu" });
      }
    },
  };
}

async function priceBundleOrder(trx: Transaction<DB>, order: OrderRow, userId: number): Promise<Priced> {
  const bundle = await trx.selectFrom("courseBundles").selectAll().where("id", "=", order.bundleId!).executeTakeFirst();
  if (!bundle || !bundle.isPublished) throw new RetryRefusal("This bundle is no longer available, so this order cannot be paid.");
  const expired = await expiredPurchaseError(trx, "course_bundle", bundle.id);
  if (expired) throw new RetryRefusal(expired);
  const enrolled = await trx
    .selectFrom("bundleEnrollments")
    .select("id")
    .where("studentId", "=", userId)
    .where("bundleId", "=", bundle.id)
    .executeTakeFirst();
  if (enrolled) throw new RetryRefusal("You are already enrolled in this bundle.");

  const notes: string[] = [];
  const bundlePrice = Number(bundle.price);
  let promo: BundlePromoResult | null = null;
  if (order.promoCodeId) {
    try {
      promo = await validateBundlePromo(trx, order.promoCodeId, bundle, userId, bundlePrice);
    } catch (error) {
      notes.push(`Your coupon could not be applied again: ${errorText(error)}`);
    }
  }
  const discountAmount = promo?.discountAmount ?? 0;
  const useTcoins = order.tcoinsRedeemed > 0;
  const tcoins = await planTcoinsForOrder(trx, {
    userId,
    orderValue: bundlePrice,
    amountBeforeTcoins: Math.max(0, bundlePrice - discountAmount),
    useTcoins,
    hasCoupon: promo !== null,
  });
  if (useTcoins && tcoins.tcoinsRedeemed < order.tcoinsRedeemed) {
    notes.push("Fewer Tcoins are available than when you placed this order.");
  }
  const platformFeePercentage = await getTeacherPlatformFee(bundle.teacherId, trx);

  return {
    total: tcoins.amountToPay,
    productInfo: bundle.title.substring(0, 100),
    notes,
    orderColumns: {
      discountAmount: discountAmount.toFixed(2),
      promoCodeId: promo ? promo.promoCode.id : null,
      platformFeePercentage: platformFeePercentage.toFixed(2),
      tcoinsRedeemed: tcoins.tcoinsRedeemed,
      tcoinsCashback: tcoins.tcoinsCashback,
      tcoinsCashbackExpiresAt: tcoins.tcoinsCashbackExpiresAt,
    },
    write: async () => {
      await trx.deleteFrom("promoCodeUsages").where("orderId", "=", order.id).execute();
      if (promo) {
        await recordBundlePromoUsage(trx, promo.promoCode.id, userId, order.id, promo.discountAmount);
      }
    },
  };
}

async function priceLiveTestOrder(trx: Transaction<DB>, order: OrderRow, userId: number, liveTestId: number): Promise<Priced> {
  const liveTest = await trx.selectFrom("liveTests").selectAll().where("id", "=", liveTestId).executeTakeFirst();
  if (!liveTest || !liveTest.isActive) throw new RetryRefusal("This live test is no longer active.");
  const expired = await expiredPurchaseError(trx, "live_test", liveTestId);
  if (expired) throw new RetryRefusal(expired);
  const now = new Date();
  if (liveTest.endTime && new Date(liveTest.endTime) < now) throw new RetryRefusal("This live test has already ended.");
  if (liveTest.registrationDeadline && new Date(liveTest.registrationDeadline) < now) {
    throw new RetryRefusal("The registration deadline for this test has passed.");
  }
  if (liveTest.enrolledCount >= liveTest.maxSeats) throw new RetryRefusal("Sorry, all seats for this live test are filled.");
  const enrolled = await trx
    .selectFrom("liveTestEnrollments")
    .select("id")
    .where("studentId", "=", userId)
    .where("liveTestId", "=", liveTestId)
    .executeTakeFirst();
  if (enrolled) throw new RetryRefusal("You are already enrolled in this live test.");

  const amount = liveTestEffectivePrice(liveTest.price, liveTest.discountPrice);
  const notes = differs(amount, Number(order.totalAmount)) ? ["The entry fee for this live test has changed."] : [];
  const mockTest = await trx.selectFrom("mockTests").select("teacherId").where("id", "=", liveTest.mockTestId).executeTakeFirst();
  const platformFeePercentage = mockTest ? await getTeacherPlatformFee(mockTest.teacherId, trx) : DEFAULT_TEACHER_PLATFORM_FEE;

  return {
    total: amount,
    productInfo: liveTest.title.substring(0, 100),
    notes,
    orderColumns: {},
    write: async () => {
      await trx
        .updateTable("orderItems")
        .set({ priceAtPurchase: amount.toFixed(2), platformFeePercentage: platformFeePercentage.toFixed(2) })
        .where("orderId", "=", order.id)
        .execute();
    },
  };
}

function priceOrder(trx: Transaction<DB>, kind: DirectRetryKind, order: OrderRow, userId: number): Promise<Priced> {
  if (kind === "bundle") return priceBundleOrder(trx, order, userId);
  if (kind === "live") return priceLiveTestOrder(trx, order, userId, liveTestIdFromTxnid(order.paymentTransactionId!)!);
  return priceCartOrder(trx, order, userId);
}

const failureColumnsOf = (order: OrderRow) => ({
  paymentErrorCode: order.paymentErrorCode,
  paymentErrorMessage: order.paymentErrorMessage,
  paymentBankMessage: order.paymentBankMessage,
  paymentGatewayStatus: order.paymentGatewayStatus,
});

const json = (body: unknown, status = 200) => new Response(superjson.stringify(body), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") throw new RetryRefusal("Only students can pay for orders.", 403);
    const input = schema.parse(superjson.parse(await request.text()));

    const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
    const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;
    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      console.error("[RetryPayment] PayU merchant key or salt is not configured.");
      throw new RetryRefusal("Payment gateway is not configured. Please contact support.", 500);
    }

    const order = await db
      .selectFrom("orders")
      .selectAll()
      .where("id", "=", input.orderId)
      .where("userId", "=", user.id)
      .executeTakeFirst();
    if (!order) throw new RetryRefusal("Order not found.", 404);

    const kind = directRetryKind({ ...order, paymentFailure: failureColumnsOf(order) });
    if (!kind) throw new RetryRefusal("This order cannot be paid again from here.", 409);
    const previousTxnid = order.paymentTransactionId!;

    // The last attempt must be settled at PayU, or the student could pay twice.
    const previous = await verifyPayUPayment(previousTxnid);
    if (previous.success && previous.status === "success") {
      await db
        .updateTable("orders")
        .set(previous.failure ?? { paymentGatewayStatus: "success" })
        .where("id", "=", order.id)
        .where("status", "=", "failed")
        .execute();
      console.error(`[RetryPayment] PayU reports txnid ${previousTxnid} of failed order ${order.id} as paid. Needs reconciliation.`);
      throw new RetryRefusal(
        "PayU has reported a payment for this order, so it was not charged again. We will confirm it shortly; contact support if it is not.",
        409
      );
    }
    if (previous.success && previous.status !== "failure") {
      throw new RetryRefusal("Your last payment attempt for this order is still being processed by the bank. Please check again in a few minutes.", 409);
    }
    if (!previous.success && previous.status !== "not_found") {
      console.error(`[RetryPayment] Could not verify txnid ${previousTxnid} for order ${order.id}: ${previous.error}`);
      throw new RetryRefusal("We could not check your last payment attempt with PayU. Please try again in a minute.", 503);
    }

    const started = await db.transaction().execute(async (trx) => {
      // The row lock and the txnid check let only one retry start per failed attempt.
      const locked = await trx.selectFrom("orders").selectAll().where("id", "=", order.id).forUpdate().executeTakeFirstOrThrow();
      if (locked.status !== "failed" || locked.paymentTransactionId !== previousTxnid) {
        throw new RetryRefusal("A payment for this order has already been started. Refresh the page to see its status.", 409);
      }

      const priced = await priceOrder(trx, kind, locked, user.id);
      const total = roundMoney(priced.total);
      if (total <= 0) {
        throw new RetryRefusal("This order no longer needs a payment. Add its items to your cart to get them.");
      }
      const previousAmount = Number(locked.totalAmount);
      const accepted = input.confirmedAmount !== undefined && !differs(input.confirmedAmount, total);
      if (differs(total, previousAmount) && !accepted) {
        const notes = priced.notes.length > 0 ? priced.notes : ["Prices or offers have changed since you placed this order."];
        throw new AmountChanged(locked.id, previousAmount, total, notes);
      }

      const liveTestId = kind === "live" ? liveTestIdFromTxnid(previousTxnid) : null;
      const txnid = liveTestId !== null ? `live-test-${liveTestId}-${nanoid(12)}` : `testkart-${nanoid(12)}`;

      await priced.write();
      await trx
        .updateTable("orders")
        .set({
          ...priced.orderColumns,
          totalAmount: total.toFixed(2),
          status: "pending",
          paymentTransactionId: txnid,
          paymentErrorCode: null,
          paymentErrorMessage: null,
          paymentBankMessage: null,
          paymentGatewayStatus: null,
          paymentMode: null,
          updatedAt: new Date(),
        })
        .where("id", "=", locked.id)
        .execute();
      // The first attempt is kept too, so a late answer for it still finds this order.
      await recordPaymentAttempt(trx, locked.id, previousTxnid, locked.createdAt ?? undefined);
      await recordPaymentAttempt(trx, locked.id, txnid);

      return { txnid, amount: total.toFixed(2), productInfo: priced.productInfo };
    });

    const email = user.email ?? `${user.mobileNumber}@mail.testkart.in`;
    const firstname = sanitizePayuText(user.displayName || "Student");
    const productinfo = sanitizePayuText(started.productInfo);
    const hashString = `${PAYU_MERCHANT_KEY}|${started.txnid}|${started.amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
    const payu: PayuFormFields = {
      key: PAYU_MERCHANT_KEY,
      txnid: started.txnid,
      amount: started.amount,
      productinfo,
      firstname,
      email,
      phone: user.mobileNumber || "9999999999",
      surl: "https://testkart.in/_api/payment/payu/callback",
      furl: "https://testkart.in/_api/payment/payu/callback",
      hash: createHash("sha512").update(hashString).digest("hex"),
      payuUrl: PAYU_MODE !== "production" ? "https://test.payu.in/_payment" : "https://secure.payu.in/_payment",
    };

    await recordFunnelEvent({
      event: "checkout_started",
      request,
      userId: user.id,
      orderId: order.id,
      amount: started.amount,
      props: { path: "order_retry", kind },
    });
    console.log(`[RetryPayment] Order ${order.id} (${kind}) retried: ${previousTxnid} -> ${started.txnid}, amount ${started.amount}`);

    return json({ kind: "redirect", orderId: order.id, payu } satisfies OutputType);
  } catch (error) {
    if (error instanceof AmountChanged) {
      return json({
        kind: "amountChanged",
        orderId: error.orderId,
        previousAmount: error.previousAmount,
        newAmount: error.newAmount,
        notes: error.notes,
      } satisfies OutputType);
    }
    if (error instanceof RetryRefusal) {
      return json({ error: error.message }, error.status);
    }
    console.error("[RetryPayment] Failed to retry payment:", error);
    return json({ error: error instanceof Error ? error.message : "Could not restart the payment. Please try again." }, 500);
  }
}
