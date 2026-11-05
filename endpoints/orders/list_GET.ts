import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access." }),
        { status: 403 }
      );
    }

    const orders = await db
      .selectFrom("orders")
      .leftJoin("orderItems as oi", "oi.orderId", "orders.id")
      .leftJoin("courseBundles", "orders.bundleId", "courseBundles.id")
      .select([
        "orders.id",
        "orders.createdAt",
        "orders.status",
        "orders.totalAmount",
        "courseBundles.title as bundleTitle",
        // Use sql.raw to cast the count to an integer, as it comes back as a bigint string by default
        sql<number>`CAST(COUNT(oi.id) AS INTEGER)`.as("itemCount"),
      ])
      .where("orders.userId", "=", user.id)
      .groupBy(["orders.id", "courseBundles.title"])
      .orderBy("orders.createdAt", "desc")
      .execute();

    // Item names for cart orders; a bundle order is named after its bundle.
    const cartOrderIds = orders.filter((o) => !o.bundleTitle).map((o) => o.id);
    const itemRows = cartOrderIds.length
      ? await db
          .selectFrom("orderItems")
          .leftJoin("mockTests", "orderItems.mockTestId", "mockTests.id")
          .leftJoin("courses", "orderItems.courseId", "courses.id")
          .leftJoin("digitalProducts", "orderItems.digitalProductId", "digitalProducts.id")
          .where("orderItems.orderId", "in", cartOrderIds)
          .select([
            "orderItems.orderId",
            "mockTests.title as testTitle",
            "courses.title as courseTitle",
            "digitalProducts.title as productTitle",
          ])
          .orderBy("orderItems.id", "asc")
          .execute()
      : [];

    const titlesByOrder = new Map<number, string[]>();
    for (const row of itemRows) {
      const title = row.testTitle ?? row.courseTitle ?? row.productTitle;
      if (!title) continue;
      const list = titlesByOrder.get(row.orderId) ?? [];
      list.push(title);
      titlesByOrder.set(row.orderId, list);
    }

    const result: OutputType = {
      orders: orders.map(({ bundleTitle, ...order }) => {
        const titles = titlesByOrder.get(order.id) ?? [];
        return {
          ...order,
          title:
            bundleTitle ??
            (titles.length > 1 ? `${titles[0]} and ${titles.length - 1} more` : titles[0] ?? `Order #${order.id}`),
        };
      }),
    };

    return new Response(superjson.stringify(result));
  } catch (error) {
    console.error("Error fetching student orders:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}