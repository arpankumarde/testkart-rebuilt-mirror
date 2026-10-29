import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { countOrders, findOrderIds, loadOrderRows } from "../../../helpers/adminOrderQuery";
import { EXPORT_ROW_LIMIT, schema, type OutputType } from "./export_POST.schema";

/** Every order matching the filters, not just the page on screen, for the CSV and invoice ZIP. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const [total, ids] = await Promise.all([
      countOrders(input.filters),
      findOrderIds(input.filters, input.sort, EXPORT_ROW_LIMIT),
    ]);
    const rows = await loadOrderRows(ids);

    return new Response(
      superjson.stringify({ rows, total, truncated: total > rows.length } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin/orders/export] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}