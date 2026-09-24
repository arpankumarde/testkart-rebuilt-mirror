import { sql, type Kysely } from "kysely";
import type { DB } from "./schema";

/**
 * A promo code use counts while its order is paid or still at checkout. Failed and
 * cancelled payment attempts give the use back, so a student can retry and a code's
 * limit is only spent by real purchases. promo_codes.usage_count is no longer kept.
 */
export const HELD_ORDER_STATUSES = ["pending", "completed"] as const;

/** Uses of the promo_codes row in scope, for selects and filters on promo_codes. */
export const promoCodeUsesSql = () =>
  sql<number>`(select count(*)::int from promo_code_usages pcu left join orders pco on pco.id = pcu.order_id where pcu.promo_code_id = promo_codes.id and (pcu.order_id is null or pco.status in ('pending', 'completed')))`;

export async function countPromoCodeUses(
  executor: Kysely<DB>,
  promoCodeId: number,
  userId?: number
): Promise<number> {
  let query = executor
    .selectFrom("promoCodeUsages")
    .leftJoin("orders", "orders.id", "promoCodeUsages.orderId")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("promoCodeUsages.promoCodeId", "=", promoCodeId)
    .where((eb) =>
      eb.or([
        eb("promoCodeUsages.orderId", "is", null),
        eb("orders.status", "in", [...HELD_ORDER_STATUSES]),
      ])
    );
  if (userId !== undefined) {
    query = query.where("promoCodeUsages.userId", "=", userId);
  }
  const row = await query.executeTakeFirst();
  return Number(row?.count ?? 0);
}