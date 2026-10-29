import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { countOrders, countReconcilable, findOrderIds, loadOrderRows } from "../../../helpers/adminOrderQuery";
import { schema, type OutputType } from "./search_POST.schema";

/** One page of the admin Transactions table, filtered and sorted in the database. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const [total, ids, reconcilable] = await Promise.all([
      countOrders(input.filters),
      findOrderIds(input.filters, input.sort, input.pageSize, (input.page - 1) * input.pageSize),
      countReconcilable(),
    ]);
    const rows = await loadOrderRows(ids);

    return new Response(
      superjson.stringify({ rows, total, page: input.page, pageSize: input.pageSize, reconcilable } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin/orders/search] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
