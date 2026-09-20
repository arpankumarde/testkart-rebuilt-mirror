import { useCallback, useMemo, useState } from "react";

export type SortOrder = "asc" | "desc";
export type SortValue = string | number | boolean | Date | null | undefined;
export type SortAccessors<T, K extends string> = Record<K, (row: T) => SortValue>;

export interface TableSortState<K extends string> {
  sortBy: K | null;
  sortOrder: SortOrder;
  toggleSort: (column: K) => void;
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const isEmpty = (value: SortValue) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const toComparable = (value: SortValue): string | number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value as string | number;
};

/* Empty values always sink to the bottom, whichever way the column is sorted. */
export const compareSortValues = (a: SortValue, b: SortValue, order: SortOrder): number => {
  const aEmpty = isEmpty(a);
  const bEmpty = isEmpty(b);
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  const left = toComparable(a);
  const right = toComparable(b);
  const result =
    typeof left === "string" && typeof right === "string"
      ? collator.compare(left, right)
      : Number(left) - Number(right);
  return order === "asc" ? result : -result;
};

/* Text starts A to Z; numbers, money and dates start with the largest or newest first. */
const firstOrderFor = <T,>(rows: T[] | undefined, accessor: (row: T) => SortValue): SortOrder => {
  const sample = rows?.map(accessor).find((value) => !isEmpty(value));
  return typeof sample === "string" ? "asc" : "desc";
};

/**
 * Client-side sorting for lists that are fully loaded in the browser. Until a header is
 * clicked the rows keep the order the server sent. Paginated lists must sort on the server.
 */
export function useTableSort<T, K extends string>(
  rows: T[] | undefined,
  accessors: SortAccessors<T, K>,
  initial?: { sortBy: K; sortOrder: SortOrder }
) {
  const [sortBy, setSortBy] = useState<K | null>(initial?.sortBy ?? null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initial?.sortOrder ?? "asc");

  const toggleSort = useCallback(
    (column: K) => {
      if (column === sortBy) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        return;
      }
      setSortBy(column);
      setSortOrder(firstOrderFor(rows, accessors[column]));
    },
    [sortBy, rows, accessors]
  );

  const sorted = useMemo(() => {
    if (!rows) return [];
    if (sortBy === null) return rows;
    const accessor = accessors[sortBy];
    return [...rows].sort((a, b) => compareSortValues(accessor(a), accessor(b), sortOrder));
  }, [rows, sortBy, sortOrder, accessors]);

  const state: TableSortState<K> = { sortBy, sortOrder, toggleSort };
  return { sorted, ...state };
}