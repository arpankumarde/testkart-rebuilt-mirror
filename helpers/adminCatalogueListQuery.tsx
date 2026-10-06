import { sql, Expression, RawBuilder } from "kysely";
import { ADMIN_CATALOGUE_PAGE_SIZE } from "./adminCatalogueList";

/* An ILIKE pattern that matches the term anywhere, with its own % and _ taken literally. */
export const containsPattern = (term: string): string =>
  `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/* Empty values sink to the bottom whichever way the column is sorted, as in the client-side tables. */
export const orderNullsLast = (
  expression: Expression<unknown> | RawBuilder<unknown>,
  order: "asc" | "desc"
): RawBuilder<unknown> => sql`${expression} ${sql.raw(order === "asc" ? "asc" : "desc")} nulls last`;

export const pageWindow = (page: number, total: number) => {
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_CATALOGUE_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  return {
    page: current,
    totalPages,
    limit: ADMIN_CATALOGUE_PAGE_SIZE,
    offset: (current - 1) * ADMIN_CATALOGUE_PAGE_SIZE,
  };
};