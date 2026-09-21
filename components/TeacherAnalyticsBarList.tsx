import React from "react";
import { Link } from "react-router-dom";
import styles from "./TeacherAnalyticsBarList.module.css";

export type AnalyticsBarRow = {
  key: string;
  label: string;
  /** Muted second line under the label. */
  meta?: string;
  value: number;
  /** The value as text, shown at the bar's tip. */
  display: string;
  href?: string;
};

type Props = {
  rows: AnalyticsBarRow[];
  /** Bar length is value / max; defaults to the largest value in rows. */
  max?: number;
  slot?: 1 | 2;
  className?: string;
};

/**
 * Horizontal bars with the label above and the value at the tip, for ranked
 * lists where every bar is labelled (content types, top items, star counts).
 */
export const TeacherAnalyticsBarList = ({ rows, max, slot = 1, className }: Props) => {
  const top = max ?? Math.max(0, ...rows.map((row) => row.value));
  return (
    <ol className={`${styles.list} ${className ?? ""}`.trim()}>
      {rows.map((row) => {
        const share = top > 0 ? Math.max(0, Math.min(1, row.value / top)) : 0;
        return (
          <li key={row.key} className={styles.row}>
            <span className={styles.labels}>
              {row.href ? (
                <Link to={row.href} className={styles.label} title={row.label}>
                  {row.label}
                </Link>
              ) : (
                <span className={styles.label} title={row.label}>
                  {row.label}
                </span>
              )}
              {row.meta && <span className={styles.meta}>{row.meta}</span>}
            </span>
            <span className={styles.track}>
              <span
                className={`${styles.bar} ${slot === 1 ? styles.slot1 : styles.slot2}`}
                // The longest bar leaves room for its value at the tip.
                style={{ width: `calc((100% - 6rem) * ${share.toFixed(4)})` }}
              />
              <span className={styles.value}>{row.display}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};