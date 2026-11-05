import { sql, type RawBuilder } from "kysely";

/**
 * The public catalogue (mock tests, study notes and courses, both the list
 * endpoints and their SSR counterparts) lists paid items ahead of free ones
 * under every sort except the price sorts. Free items collect the most
 * enrolments, so without this they fill the first pages. They still list
 * after the paid ones and under the Free filter.
 */

/** The price a mock test card shows: the discount price when set, else the list price. */
export const mockTestShownPriceSql = sql<string>`COALESCE(mock_tests.discount_price, mock_tests.price)`;

export function paidFirst(shownPrice: RawBuilder<unknown>) {
  return sql<number>`CASE WHEN ${shownPrice} > 0 THEN 0 ELSE 1 END`;
}

export function sortPutsPaidFirst(sort: string | undefined) {
  return sort !== "price_asc" && sort !== "price_desc";
}
