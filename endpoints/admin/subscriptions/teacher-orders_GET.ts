import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, schema } from "./teacher-orders_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { z } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    // Verify admin session
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    // Parse and validate query params
    const url = new URL(request.url);
    const rawTeacherId = url.searchParams.get("teacherId");
    
    const params = schema.parse({
      teacherId: rawTeacherId ? parseInt(rawTeacherId, 10) : undefined,
    });

    // Query for completed order items belonging to this teacher's content
    const rawOrderItems = await db
      .selectFrom("orderItems as oi")
      .innerJoin("orders as o", "o.id", "oi.orderId")
      .innerJoin("users as u", "u.id", "o.userId")
      .leftJoin("mockTests as mt", "mt.id", "oi.mockTestId")
      .leftJoin("courses as c", "c.id", "oi.courseId")
      .leftJoin("digitalProducts as dp", "dp.id", "oi.digitalProductId")
      .where("o.status", "=", "completed")
      .where((eb) =>
        eb.or([
          eb("mt.teacherId", "=", params.teacherId),
          eb("c.teacherId", "=", params.teacherId),
          eb("dp.teacherId", "=", params.teacherId),
        ])
      )
      .select([
        "oi.id as orderItemId",
        "oi.orderId",
        "o.createdAt as orderDate",
        "oi.priceAtPurchase",
        "oi.discountAmount",
        "oi.platformFeePercentage as currentPlatformFee",
        "u.displayName as studentName",
        sql<string>`COALESCE(mt.title, c.title, dp.title)`.as("productName"),
        sql<string>`CASE
          WHEN mt.id IS NOT NULL THEN 'mock_test'
          WHEN c.id IS NOT NULL THEN 'course'
          WHEN dp.id IS NOT NULL THEN 'digital_product'
          ELSE 'unknown'
        END`.as("productType"),
      ])
      .orderBy("o.createdAt", "desc")
      .limit(100)
      .execute();

    // Map the raw records to our structured output type, handling numeric parsing
    const orderItems = rawOrderItems.map((item) => ({
      orderItemId: item.orderItemId,
      orderId: item.orderId,
      orderDate: item.orderDate ? new Date(item.orderDate) : null,
      productName: item.productName || "Unknown Product",
      productType: item.productType as "mock_test" | "course" | "digital_product" | "unknown",
      priceAtPurchase: Number(item.priceAtPurchase),
      discountAmount: Number(item.discountAmount),
      currentPlatformFee: Number(item.currentPlatformFee),
      studentName: item.studentName,
    }));

    const output: OutputType = {
      orderItems,
    };

    return new Response(superjson.stringify(output), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid request parameters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.error("Error fetching teacher orders:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}