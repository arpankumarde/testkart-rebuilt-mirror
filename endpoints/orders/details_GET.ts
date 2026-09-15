import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType } from "./details_GET.schema";
import { paymentFailureReason } from "../../helpers/paymentFailureReason";
import superjson from "superjson";
import { z } from "zod";

const inputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
});

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const url = new URL(request.url);
    const orderId = url.searchParams.get("id");

    const validationResult = inputSchema.safeParse({ orderId });

    if (!validationResult.success) {
      return new Response(
        superjson.stringify({ error: "Invalid order ID provided." }),
        { status: 400 }
      );
    }

    const validatedOrderId = validationResult.data.orderId;

    const order = await db
      .selectFrom("orders")
      .selectAll()
      .where("id", "=", validatedOrderId)
      .where("userId", "=", user.id) // Security check
      .executeTakeFirst();

    if (!order) {
      return new Response(
        superjson.stringify({ error: "Order not found." }),
        { status: 404 }
      );
    }

    // Resolve the promo code (if any) so we can show the student why the
    // total they paid is less than the sum of the item prices.
    let promoCode: string | null = null;
    if (order.promoCodeId) {
      const promo = await db
        .selectFrom("promoCodes")
        .select("code")
        .where("id", "=", order.promoCodeId)
        .executeTakeFirst();
      promoCode = promo?.code ?? null;
    }

    const discountAmount = order.discountAmount ? parseFloat(order.discountAmount) : 0;
    const totalAmount = parseFloat(order.totalAmount);
    const subtotal = parseFloat((totalAmount + discountAmount).toFixed(2));

    // Fetch all order items with LEFT JOINs on all product tables
    const rawItems = await db
      .selectFrom("orderItems")
      .leftJoin("mockTests", "orderItems.mockTestId", "mockTests.id")
      .leftJoin("courses", "orderItems.courseId", "courses.id")
      .leftJoin("digitalProducts", "orderItems.digitalProductId", "digitalProducts.id")
      .where("orderItems.orderId", "=", validatedOrderId)
      .select([
        "orderItems.id as orderItemId",
        "orderItems.priceAtPurchase",
        "orderItems.mockTestId",
        "orderItems.courseId",
        "orderItems.digitalProductId",
        "mockTests.title as mockTestTitle",
        "mockTests.thumbnailUrl as mockTestThumbnail",
        "courses.title as courseTitle",
        "courses.thumbnailImageUrl as courseThumbnail",
        "digitalProducts.title as digitalProductTitle",
        "digitalProducts.thumbnailUrl as digitalProductThumbnail",
      ])
      .execute();

    // Resolve the bundle (if any) as an additional top-level item
    let bundleItem = null;
    if (order.bundleId) {
      const bundle = await db
        .selectFrom("courseBundles")
        .select(["id", "title", "thumbnailUrl", "price"])
        .where("id", "=", order.bundleId)
        .executeTakeFirst();

      if (bundle) {
        bundleItem = {
          orderItemId: -1, // synthetic id for bundle
          mockTestId: null,
          courseId: null,
          digitalProductId: null,
          bundleId: bundle.id,
          itemType: "bundle" as const,
          title: bundle.title,
          thumbnailUrl: bundle.thumbnailUrl,
          priceAtPurchase: parseFloat(order.totalAmount),
        };
      }
    }

    const items = rawItems.map(item => {
      if (item.mockTestId != null) {
        return {
          orderItemId: item.orderItemId,
          mockTestId: item.mockTestId,
          courseId: null,
          digitalProductId: null,
          bundleId: null,
          itemType: "test" as const,
          title: item.mockTestTitle ?? "Unknown Test",
          thumbnailUrl: item.mockTestThumbnail,
          priceAtPurchase: parseFloat(item.priceAtPurchase),
        };
      } else if (item.courseId != null) {
        return {
          orderItemId: item.orderItemId,
          mockTestId: null,
          courseId: item.courseId,
          digitalProductId: null,
          bundleId: null,
          itemType: "course" as const,
          title: item.courseTitle ?? "Unknown Course",
          thumbnailUrl: item.courseThumbnail,
          priceAtPurchase: parseFloat(item.priceAtPurchase),
        };
      } else if (item.digitalProductId != null) {
        return {
          orderItemId: item.orderItemId,
          mockTestId: null,
          courseId: null,
          digitalProductId: item.digitalProductId,
          bundleId: null,
          itemType: "product" as const,
          title: item.digitalProductTitle ?? "Unknown Product",
          thumbnailUrl: item.digitalProductThumbnail,
          priceAtPurchase: parseFloat(item.priceAtPurchase),
        };
      } else {
        // Fallback for unrecognized item types
        return {
          orderItemId: item.orderItemId,
          mockTestId: null,
          courseId: null,
          digitalProductId: null,
          bundleId: null,
          itemType: "test" as const,
          title: "Unknown Item",
          thumbnailUrl: null,
          priceAtPurchase: parseFloat(item.priceAtPurchase),
        };
      }
    });

    // If the order has a bundle and no individual items were returned, use the bundle item
    const resolvedItems = items.length > 0 ? items : bundleItem ? [bundleItem] : [];

    const failure =
      order.status === "failed" || order.status === "cancelled"
        ? paymentFailureReason.describe({
            paymentErrorCode: order.paymentErrorCode,
            paymentErrorMessage: order.paymentErrorMessage,
            paymentBankMessage: order.paymentBankMessage,
            paymentGatewayStatus: order.paymentGatewayStatus,
          })
        : null;

    const orderDetails = {
      id: order.id,
      status: order.status,
      subtotal,
      discountAmount,
      promoCode,
      totalAmount,
      createdAt: order.createdAt,
      paymentTransactionId: order.paymentTransactionId,
      items: resolvedItems,
      paymentFailure: failure ? { reason: failure.reason, message: failure.payerMessage } : null,
    };

    return new Response(
      superjson.stringify(orderDetails satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch order details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch order details.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}