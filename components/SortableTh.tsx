import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortOrder } from "../helpers/useTableSort";
import styles from "./SortableTh.module.css";

interface SortableThProps<K extends string> {
  column: K;
  sort: { sortBy: K | null; sortOrder: SortOrder; toggleSort: (column: K) => void };
  children: React.ReactNode;
  className?: string;
}

/* A table header cell whose label sorts the column. Pass the page's numeric class to right-align it. */
export function SortableTh<K extends string>({ column, sort, children, className }: SortableThProps<K>) {
  const isActive = sort.sortBy === column;
  const Icon = !isActive ? ArrowUpDown : sort.sortOrder === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={className}
      aria-sort={isActive ? (sort.sortOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className={styles.button} onClick={() => sort.toggleSort(column)}>
        {children}
        <Icon className={`${styles.icon} ${isActive ? styles.iconActive : ""}`} aria-hidden="true" />
      </button>
    </th>
  );
}