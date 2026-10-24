import React from "react";
import { Skeleton } from "./Skeleton";
import styles from "./SpinWinStatGrid.module.css";

export type SpinStatItem = {
  label: string;
  value: string;
  /** A short qualifier under the figure, such as a rate. */
  note?: string;
  tone?: "peach" | "mint" | "lavender" | "powder" | "butter" | "sage" | "cream";
};

type Props = { items: SpinStatItem[]; isLoading?: boolean; label: string };

export const SpinWinStatGrid: React.FC<Props> = ({ items, isLoading, label }) => (
  <section className={styles.grid} aria-label={label} aria-busy={isLoading}>
    {items.map((item) => (
      <div key={item.label} className={`${styles.card} ${styles[item.tone ?? "cream"]}`}>
        <span className={styles.label}>{item.label}</span>
        {isLoading ? <Skeleton className={styles.skeleton} /> : <span className={styles.value}>{item.value}</span>}
        {item.note && !isLoading ? <span className={styles.note}>{item.note}</span> : null}
      </div>
    ))}
  </section>
);