import superjson from "superjson";
import { sql, type RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  orderWhere,
  PAYMENT_MODE_GROUP_EXPR,
  PLATFORM_EXPR,
  TEACHER_ID_EXPR,
} from "../../../helpers/adminOrderQuery";
import { ORDER_PRODUCT_TYPE_LABELS } from "../../../helpers/adminOrderFilters";
import {
  ORDER_PAYMENT_MODE_GROUP_LABELS,
  ORDER_PLATFORM_LABELS,
  paymentMethodLabel,
  type OrderPaymentModeGroup,
  type OrderPlatform,
} from "../../../helpers/orderAttribution";
import { schema, type BreakdownRow, type OrderBreakdown, type OutputType } from "./summary_POST.schema";

const PRODUCT_EXPR = sql<string>`case
  when coalesce(orders.payment_transaction_id, '') like 'live-test-%' then 'live_test'
  when orders.bundle_id is not null then 'bundle'
  when exists (select 1 from order_items oi where oi.order_id = orders.id and oi.course_id is not null) then 'course'
  when exists (select 1 from order_items oi where oi.order_id = orders.id and oi.mock_test_id is not null) then 'test'
  when exists (select 1 from order_items oi where oi.order_id = orders.id and oi.digital_product_id is not null) then 'notes'
  when exists (select 1 from order_items oi where oi.order_id = orders.id
    and (oi.mentorship_plan_id is not null or oi.mentorship_session_type_id is not null or oi.mentorship_booking_id is not null))
    then 'mentorship'
  else null end`;

/* "mode:<group>" for PayU orders (UPI, card, ...), "method:<method>" for everything paid without the gateway. */
const PAYMENT_EXPR = sql<string>`case
  when orders.payment_method = 'payu' then 'mode:' || (${PAYMENT_MODE_GROUP_EXPR})
  when orders.payment_method is null then 'method:__none'
  else 'method:' || orders.payment_method end`;

const KEY_EXPR: Record<OrderBreakdown, RawBuilder<string | number | null>> = {
  platform: PLATFORM_EXPR,
  os: sql<string | null>`orders.client_os_name`,
  browser: sql<string | null>`orders.client_browser_name`,
  brand: sql<string | null>`orders.client_device_brand`,
  paymentMode: PAYMENT_EXPR,
  teacher: sql<string | null>`(${TEACHER_ID_EXPR})::text`,
  product: PRODUCT_EXPR,
};

const BREAKDOWN_LIMIT = 12;

const num = (value: unknown) => {
  const parsed = parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Headline figures and one breakdown for every order matching the page's filters. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const where = orderWhere(input.filters);

    const [totalsRow, groups] = await Promise.all([
      db
        .selectFrom("orders")
        .select([
          sql<string>`count(*)`.as("orders"),
          sql<string>`count(*) filter (where orders.status = 'completed')`.as("completed"),
          sql<string>`coalesce(sum(orders.total_amount) filter (where orders.status = 'completed'), 0)`.as("revenue"),
          sql<string>`count(*) filter (where orders.status = 'pending')`.as("pending"),
          sql<string>`count(*) filter (where orders.status = 'failed')`.as("failed"),
          sql<string>`count(*) filter (where orders.status = 'cancelled')`.as("cancelled"),
          sql<string>`count(*) filter (where orders.status = 'refunded')`.as("refunded"),
          sql<string>`coalesce(sum(orders.total_amount) filter (where orders.status = 'refunded'), 0)`.as("refundedAmount"),
          sql<string>`count(*) filter (where orders.client_source is not null)`.as("attributed"),
        ])
        .where(where)
        .executeTakeFirst(),
      db
        .selectFrom("orders")
        .select([
          KEY_EXPR[input.breakdown].as("key"),
          sql<string>`count(*)`.as("orders"),
          sql<string>`count(*) filter (where orders.status = 'completed')`.as("completed"),
          sql<string>`coalesce(sum(orders.total_amount) filter (where orders.status = 'completed'), 0)`.as("revenue"),
        ])
        .where(where)
        .groupBy(sql`1`)
        .orderBy(sql`count(*) desc, 1`)
        .limit(BREAKDOWN_LIMIT)
        .execute(),
    ]);

    let teacherNames = new Map<number, string>();
    if (input.breakdown === "teacher") {
      const ids = groups.map((g) => Number(g.key)).filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length) {
        const teachers = await db.selectFrom("users").select(["id", "displayName"]).where("id", "in", ids).execute();
        teacherNames = new Map(teachers.map((t) => [t.id, t.displayName]));
      }
    }

    const labelFor = (key: string | null): string => {
      if (key === null) return input.breakdown === "teacher" ? "No teacher" : "Not captured";
      switch (input.breakdown) {
        case "platform":
          return ORDER_PLATFORM_LABELS[key as OrderPlatform] ?? key;
        case "paymentMode": {
          const [kind, value] = key.split(":");
          if (kind === "mode") {
            return value === "unknown"
              ? "PayU, mode not recorded"
              : `PayU, ${ORDER_PAYMENT_MODE_GROUP_LABELS[value as OrderPaymentModeGroup] ?? value}`;
          }
          return value === "__none" ? "Not recorded" : paymentMethodLabel(value);
        }
        case "product":
          return ORDER_PRODUCT_TYPE_LABELS[key as keyof typeof ORDER_PRODUCT_TYPE_LABELS] ?? key;
        case "teacher":
          return teacherNames.get(Number(key)) ?? `Teacher #${key}`;
        default:
          return key;
      }
    };

    const rows: BreakdownRow[] = groups.map((g) => {
      const key = g.key === null || g.key === undefined ? null : String(g.key);
      return {
        key,
        label: labelFor(key),
        orders: num(g.orders),
        completed: num(g.completed),
        revenue: num(g.revenue),
      };
    });

    const output: OutputType = {
      totals: {
        orders: num(totalsRow?.orders),
        completed: num(totalsRow?.completed),
        revenue: num(totalsRow?.revenue),
        pending: num(totalsRow?.pending),
        failed: num(totalsRow?.failed),
        cancelled: num(totalsRow?.cancelled),
        refunded: num(totalsRow?.refunded),
        refundedAmount: num(totalsRow?.refundedAmount),
        attributed: num(totalsRow?.attributed),
      },
      breakdown: input.breakdown,
      rows,
    };

    return new Response(superjson.stringify(output), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[admin/orders/summary] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
