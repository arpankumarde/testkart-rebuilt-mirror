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
      .select([
        "orders.id",
        "orders.createdAt",
        "orders.status",
        "orders.totalAmount",
        // Use sql.raw to cast the count to an integer, as it comes back as a bigint string by default
        sql<number>`CAST(COUNT(oi.id) AS INTEGER)`.as("itemCount"),
      ])
      .where("orders.userId", "=", user.id)
      .groupBy("orders.id")
      .orderBy("orders.createdAt", "desc")
      .execute();

    return new Response(superjson.stringify({ orders } satisfies OutputType));
  } catch (error) {
    console.error("Error fetching student orders:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}