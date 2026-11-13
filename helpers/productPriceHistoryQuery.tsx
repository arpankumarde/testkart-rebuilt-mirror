import type { Kysely } from "kysely";
import type { DB } from "./schema";
import type { PriceHistoryEntry } from "../endpoints/admin/price-history/list_GET.schema";
import type { PriceChangeSource, PriceHistoryProductType } from "./productPriceHistory";

/* The history table with the names an admin reads: the product's teacher and whoever made the change. */
export const priceHistoryRows = (executor: Kysely<DB>) =>
  executor
    .selectFrom("productPriceHistory as h")
    .leftJoin("users as teacher", "teacher.id", "h.teacherId")
    .leftJoin("users as actor", "actor.id", "h.changedByUserId")
    .leftJoin("admins as actorAdmin", "actorAdmin.id", "h.changedByAdminId");

export const PRICE_HISTORY_COLUMNS = [
  "h.id",
  "h.productType",
  "h.productId",
  "h.productTitle",
  "h.teacherId",
  "teacher.displayName as teacherName",
  "teacher.email as teacherEmail",
  "h.previousPrice",
  "h.newPrice",
  "h.previousListPrice",
  "h.newListPrice",
  "h.changeSource",
  "h.changedByUserId",
  "h.changedByAdminId",
  "actor.displayName as actorName",
  "actorAdmin.fullName as actorAdminName",
  "h.changedAt",
] as const;

type RawRow = {
  id: string;
  productType: string;
  productId: string;
  productTitle: string;
  teacherId: number | null;
  teacherName: string | null;
  teacherEmail: string | null;
  previousPrice: string;
  newPrice: string;
  previousListPrice: string | null;
  newListPrice: string | null;
  changeSource: string;
  changedByUserId: number | null;
  changedByAdminId: number | null;
  actorName: string | null;
  actorAdminName: string | null;
  changedAt: Date;
};

const amountOrNull = (value: string | null): number | null => (value === null ? null : Number(value));

/* A teacher or admin who has since been removed keeps their id; the name falls back to it. */
export function toPriceHistoryEntry(row: RawRow): PriceHistoryEntry {
  const changedByName =
    row.changedByAdminId !== null
      ? `${row.actorAdminName ?? `Admin #${row.changedByAdminId}`} (admin)`
      : row.changedByUserId !== null
        ? row.actorName ?? `User #${row.changedByUserId}`
        : null;
  return {
    id: Number(row.id),
    productType: row.productType as PriceHistoryProductType,
    productId: row.productId,
    productTitle: row.productTitle,
    teacherId: row.teacherId,
    teacherName: row.teacherName || row.teacherEmail || (row.teacherId !== null ? `Teacher #${row.teacherId}` : null),
    previousPrice: Number(row.previousPrice),
    newPrice: Number(row.newPrice),
    previousListPrice: amountOrNull(row.previousListPrice),
    newListPrice: amountOrNull(row.newListPrice),
    changeSource: row.changeSource as PriceChangeSource,
    changedByUserId: row.changedByUserId,
    changedByAdminId: row.changedByAdminId,
    changedByName,
    changedAt: row.changedAt,
  };
}