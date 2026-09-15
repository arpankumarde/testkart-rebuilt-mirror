import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { Transaction } from "kysely";
import { DB } from "../../helpers/schema";
import { getTeacherPlatformFee } from "../../helpers/getTeacherPlatformFee";

async function createOrderInTransaction(trx: Transaction<DB>, userId: number): Promise<number> {
  const cartItems = await trx
    .selectFrom("cartItems")
    .leftJoin("mockTests", "cartItems.mockTestId", "mockTests.id")
    .leftJoin("courses", "cartItems.courseId", "courses.id")
    .leftJoin("digitalProducts", "cartItems.digitalProductId", "digitalProducts.id")
    .where("cartItems.userId", "=", userId)
    .select([
      "cartItems.mockTestId",
      "cartItems.courseId",
      "cartItems.digitalProductId",
      "mockTests.price as testPrice",
      "mockTests.teacherId as testTeacherId",
      "courses.price as coursePrice",
      "courses.teacherId as courseTeacherId",
      "digitalProducts.price as digitalProductPrice",
      "digitalProducts.teacherId as digitalProductTeacherId",
    ])
    .execute();

  if (cartItems.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const totalAmount = cartItems.reduce((sum, item) => {
    let price = 0;
    if (item.mockTestId) {
      price = parseFloat(item.testPrice!);
    } else if (item.courseId) {
      price = parseFloat(item.coursePrice!);
    } else if (item.digitalProductId) {
      price = parseFloat(item.digitalProductPrice!);
    }
    return sum + price;
  }, 0);

  const newOrder = await trx
    .insertInto("orders")
    .values({
      userId: userId,
      totalAmount: totalAmount.toString(),
      status: "completed", // Assuming immediate payment for simplicity
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // Get platform fee for each item based on teacher's active subscription
  const orderItemsWithFees = await Promise.all(
    cartItems.map(async (item) => {
      // Get teacherId and price from either mockTests, courses, or digitalProducts
      let teacherId: number;
      let price: string;
      
      if (item.mockTestId) {
        teacherId = item.testTeacherId!;
        price = item.testPrice!;
      } else if (item.courseId) {
        teacherId = item.courseTeacherId!;
        price = item.coursePrice!;
      } else if (item.digitalProductId) {
        teacherId = item.digitalProductTeacherId!;
        price = item.digitalProductPrice!;
      } else {
        throw new Error("Cart item has no valid product reference");
      }

      const platformFeePercentage = (await getTeacherPlatformFee(teacherId, trx)).toFixed(2);

      return {
        orderId: newOrder.id,
        mockTestId: item.mockTestId,
        courseId: item.courseId,
        digitalProductId: item.digitalProductId,
        priceAtPurchase: price,
        platformFeePercentage: platformFeePercentage,
      };
    })
  );

  await trx.insertInto("orderItems").values(orderItemsWithFees).execute();

  // Create digital product purchases for any digital products in the order
  const digitalProductPurchases = cartItems
    .filter((item) => item.digitalProductId !== null)
    .map((item) => ({
      productId: item.digitalProductId!,
      studentId: userId,
      orderId: newOrder.id,
      purchasedAt: new Date(),
    }));

  if (digitalProductPurchases.length > 0) {
    await trx.insertInto("digitalProductPurchases").values(digitalProductPurchases).execute();
  }

  await trx.deleteFrom("cartItems").where("userId", "=", userId).execute();

  return newOrder.id;
}


export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    schema.parse({}); // No input body needed

    const orderId = await db.transaction().execute((trx) => createOrderInTransaction(trx, user.id));

    return new Response(
      superjson.stringify({
        orderId: orderId,
        message: "Order created successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to create order:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to create order.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}