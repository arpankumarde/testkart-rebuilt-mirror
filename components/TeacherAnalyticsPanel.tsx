import React from "react";
import styles from "./TeacherAnalyticsPanel.module.css";

export type AnalyticsLegendItem = { label: string; slot: 1 | 2; shape?: "box" | "line" };

export type AnalyticsDataTable = {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
};

type Props = {
  title: string;
  subtitle?: string;
  legend?: AnalyticsLegendItem[];
  actions?: React.ReactNode;
  /** The chart's numbers as a table for screen readers; charts alone are not accessible. */
  table?: AnalyticsDataTable;
  children: React.ReactNode;
  className?: string;
};

/**
 * The card every Analytics chart and list sits in: title, a muted subtitle,
 * an optional legend (always shown for two or more series) and actions.
 */
export const TeacherAnalyticsPanel = ({
  title,
  subtitle,
  legend,
  actions,
  table,
  children,
  className,
}: Props) => (
  <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label={title}>
    <div className={styles.head}>
      <div className={styles.titleGroup}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {(legend?.length || actions) && (
        <div className={styles.side}>
          {legend && legend.length > 0 && (
            <ul className={styles.legend} aria-label="Legend">
              {legend.map((item) => (
                <li key={item.label} className={styles.legendItem}>
                  <span
                    className={`${item.shape === "line" ? styles.swatchLine : styles.swatchBox} ${
                      item.slot === 1 ? styles.slot1 : styles.slot2
                    }`}
                    aria-hidden="true"
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
          {actions}
        </div>
      )}
    </div>
    {children}
    {table && table.rows.length > 0 && (
      // A table grows to fit its cells whatever width it is given, so the
      // visually hidden clip goes on a wrapper.
      <div className={styles.srOnly}>
        <table>
          <caption>{table.caption}</caption>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);