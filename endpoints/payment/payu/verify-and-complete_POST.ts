import { db } from "../../../helpers/db";
import { schema, OutputType } from "./verify-and-complete_POST.schema";
import superjson from 'superjson';
import { createHash } from "crypto";
import { sql } from "kysely";
import { ensureOrderCompletionSideEffects } from "../../../helpers/ensureOrderCompletionSideEffects";
import { completeBundleEnrollment } from "../../../helpers/completeBundleEnrollment";
import { extractPayUFailure } from "../../../helpers/extractPayUFailure";
import { paymentFailureReason } from "../../../helpers/paymentFailureReason";
import { payuLogFields } from "../../../helpers/payuLogFields";

// Type definition for the expected structure of PayU's verify payment API response
type PayUVerifyResponse = {
  status: number;
  msg: string;
  transaction_details: {
    [txnid: string]: {
      mihpayid: string;
      status: "success" | "pending" | "failure" | string; // PayU status can vary
      txnid: string;
      amount: string;
      unmappedstatus?: string;
      error_code?: string;
      error_Message?: string;
      field9?: string;
      // ... other fields
    };
  };
};

export async function handle(request: Request): Promise<Response> {
  const startTime = performance.now();
  console.log("[PayU Verify] Received verification request");

  const PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY;
  const PAYU_MERCHANT_SALT = process.env.PAYU_MERCHANT_SALT;

  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    console.error("[PayU Verify] ERROR: PayU merchant key or salt is not configured");
    return new Response(superjson.stringify({ 
      success: false, 
      message: "Payment gateway not configured.",
      orderStatus: 'failed',
      orderId: null,
    }), { status: 500 });
  }

  try {
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let txnid: string;
    let order;

    // If txnid is provided, use it directly
    if (input.txnid) {
      txnid = input.txnid;
      console.log(`[PayU Verify] Verifying with txnid: ${txnid}`);

      // Find the order with this transaction ID
      order = await db
        .selectFrom("orders")
        .selectAll()
        .where("paymentTransactionId", "=", txnid)
        .executeTakeFirst();

      if (!order) {
        console.error(`[PayU Verify] ERROR: Order not found for txnid ${txnid}`);
        return new Response(superjson.stringify({
          success: false,
          message: "Order not found.",
          orderStatus: 'failed',
          orderId: null,
        }), { status: 404 });
      }
    } 
    // If only orderId is provided, fetch the order first to get txnid
    else if (input.orderId) {
      console.log(`[PayU Verify] Verifying with orderId: ${input.orderId}`);

      order = await db
        .selectFrom("orders")
        .selectAll()
        .where("id", "=", input.orderId)
        .executeTakeFirst();

      if (!order) {
        console.error(`[PayU Verify] ERROR: Order not found for orderId ${input.orderId}`);
        return new Response(superjson.stringify({
          success: false,
          message: "Order not found.",
          orderStatus: 'failed',
          orderId: null,
        }), { status: 404 });
      }

      if (!order.paymentTransactionId) {
        console.error(`[PayU Verify] ERROR: Order ${input.orderId} has no payment transaction ID`);
        return new Response(superjson.stringify({
          success: false,
          message: "Order has no payment transaction ID.",
          orderStatus: 'failed',
          orderId: order.id,
        }), { status: 400 });
      }

      txnid = order.paymentTransactionId;
      console.log(`[PayU Verify] Found txnid ${txnid} for orderId ${input.orderId}`);
    } else {
      // This should never happen due to schema validation, but adding for type safety
      return new Response(superjson.stringify({
        success: false,
        message: "Either txnid or orderId must be provided.",
        orderStatus: 'failed',
        orderId: null,
      }), { status: 400 });
    }

    // 2. If order is already completed, ensure side effects and return success immediately (idempotent)
    if (order.status === "completed") {
      console.log(`[PayU Verify] Order ${order.id} already completed. Ensuring side effects exist.`);
      await ensureOrderCompletionSideEffects(order.id);
      return new Response(superjson.stringify({
        success: true,
        orderStatus: "completed",
        orderId: order.id,
        message: "Order already completed.",
      } satisfies OutputType));
    }

    // 3. If order is pending, call PayU's verify payment API
    const command = "verify_payment";
    const hashString = `${PAYU_MERCHANT_KEY}|${command}|${txnid}|${PAYU_MERCHANT_SALT}`;
    const hash = createHash("sha512").update(hashString).digest("hex");

    const formData = new URLSearchParams();
    formData.append("key", PAYU_MERCHANT_KEY);
    formData.append("command", command);
    formData.append("var1", txnid);
    formData.append("hash", hash);

    console.log(`[PayU Verify] Calling PayU verify API for txnid ${txnid}`);
    const payuResponse = await fetch("https://info.payu.in/merchant/postservice?form=2", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!payuResponse.ok) {
      throw new Error(`PayU API request failed with status ${payuResponse.status}`);
    }

    const payuData = (await payuResponse.json()) as PayUVerifyResponse;
    console.log(
      `[PayU Verify] PayU API response received for txnid ${txnid}:`,
      JSON.stringify({ apiStatus: payuData?.status, ...payuLogFields(payuData?.transaction_details?.[txnid]) })
    );

    const transactionDetails = payuData.transaction_details[txnid];
    if (!transactionDetails) {
      throw new Error("Transaction details not found in PayU response.");
    }

    const payuStatus = transactionDetails.status;

    // 5. If PayU says status is "success"
    if (payuStatus === "success") {
      console.log(`[PayU Verify] PayU confirmed success for txnid ${txnid}. Attempting to complete order ${order.id}.`);

      const result = await db.transaction().execute(async (trx) => {
        // Atomic update to prevent race conditions with the callback
        const updatedOrder = await trx
          .updateTable("orders")
          .set({ status: "completed" })
          .where("id", "=", order.id)
          .where("status", "=", "pending")
          .returningAll()
          .executeTakeFirst();

        if (!updatedOrder) {
          // Order was already processed by another request (e.g., the callback)
          return null;
        }

        // Get order items to determine what type of items they are
        const orderItems = await trx
          .selectFrom("orderItems")
          .select(["mockTestId", "courseId", "digitalProductId"])
          .where("orderId", "=", updatedOrder.id)
          .execute();
        
        // Separate test items, course items, and digital product items
        const mockTestIds = orderItems
          .filter(item => item.mockTestId !== null)
          .map(item => item.mockTestId!);
        
        const courseItems = orderItems
          .filter(item => item.courseId !== null)
          .map(item => item.courseId!);
        
        const digitalProductItems = orderItems
          .filter(item => item.digitalProductId !== null)
          .map(item => item.digitalProductId!);

        await Promise.all([
          // Clear user's cart
          trx
            .deleteFrom("cartItems")
            .where("userId", "=", updatedOrder.userId)
            .execute(),
          
          // For test items: increment students enrolled count
          mockTestIds.length > 0
            ? trx
                .updateTable("mockTests")
                .set({ studentsEnrolled: sql`students_enrolled + 1` })
                .where("id", "in", mockTestIds)
                .execute()
            : Promise.resolve(),
          
          // For course items: create enrollments (idempotent)
          courseItems.length > 0
            ? trx
                .insertInto("courseEnrollments")
                .values(
                  courseItems.map(courseId => ({
                    studentId: updatedOrder.userId,
                    courseId: courseId,
                    enrolledAt: new Date(),
                  }))
                )
                .onConflict((oc) =>
                  oc.columns(["studentId", "courseId"]).doNothing()
                )
                .execute()
            : Promise.resolve(),
          
          // For digital products: create purchase records (idempotent)
          digitalProductItems.length > 0
            ? trx
                .insertInto("digitalProductPurchases")
                .values(
                  digitalProductItems.map(productId => ({
                    studentId: updatedOrder.userId,
                    productId: productId,
                    orderId: updatedOrder.id,
                    purchasedAt: new Date(),
                  }))
                )
                .onConflict((oc) =>
                  oc.columns(["studentId", "productId"]).doNothing()
                )
                .execute()
            : Promise.resolve(),
          // Increment totalPurchases for digital products
          digitalProductItems.length > 0
            ? trx
                .updateTable("digitalProducts")
                .set({ totalPurchases: sql`COALESCE(total_purchases, 0) + 1` })
                .where("id", "in", digitalProductItems)
                .execute()
            : Promise.resolve(),

          // Handle bundle enrollment if order has a bundleId
          updatedOrder.bundleId
            ? completeBundleEnrollment(trx, updatedOrder.bundleId, updatedOrder.userId, updatedOrder.id)
            : Promise.resolve(),
        ]);

        return updatedOrder;
      });

      if (result) {
        console.log(`[PayU Verify] Successfully completed order ${order.id} for txnid ${txnid}.`);
        
        // Ensure all completion side effects (including live test enrollments) exist
        await ensureOrderCompletionSideEffects(order.id);

        return new Response(superjson.stringify({
          success: true,
          orderStatus: "completed",
          orderId: order.id,
          message: "Payment verified and order completed.",
        } satisfies OutputType));
      } else {
        console.log(`[PayU Verify] Order ${order.id} was already processed while verifying. Ensuring side effects exist.`);
        // Re-fetch the order to get the most up-to-date status
        const currentOrder = await db.selectFrom("orders").select("status").where("id", "=", order.id).executeTakeFirstOrThrow();
        
        // If order is completed, ensure all side effects exist
        if (currentOrder.status === "completed") {
          await ensureOrderCompletionSideEffects(order.id);
        }
        
        return new Response(superjson.stringify({
          success: true,
          orderStatus: currentOrder.status,
          orderId: order.id,
          message: "Order was processed by another request.",
        } satisfies OutputType));
      }
    }

    // 6. If PayU says pending/failed, return that status
    const finalStatus = payuStatus === "failure" ? "failed" : "pending";
    console.log(`[PayU Verify] PayU status is '${payuStatus}' for txnid ${txnid}. Order ${order.id} remains '${order.status}'.`);
    const failure =
      finalStatus === "failed" ? paymentFailureReason.describe(extractPayUFailure(transactionDetails)) : null;
    return new Response(superjson.stringify({
      success: true,
      orderStatus: finalStatus,
      orderId: order.id,
      message: failure ? failure.payerMessage : `Payment status is ${payuStatus}.`,
    } satisfies OutputType));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[PayU Verify] ERROR: Verification failed:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(superjson.stringify({ 
      success: false, 
      message: errorMessage,
      orderStatus: 'failed',
      orderId: null,
    }), { status: 500 });
  } finally {
    console.log(`[PayU Verify] Total handler time: ${performance.now() - startTime}ms`);
  }
}