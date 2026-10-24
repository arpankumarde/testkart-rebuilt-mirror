import React from "react";
import styles from "./SpinWinDataTable.module.css";

export type SpinColumn<T> = {
  key: string;
  header: string;
  /** Fixed rem width; leave one identity column without a width so it flexes. */
  width?: string;
  align?: "right";
  render: (row: T) => React.ReactNode;
  /** Hidden from the narrow card layout, e.g. the identity column already in the card title. */
  hideInCard?: boolean;
};

type Props<T> = {
  rows: T[];
  columns: SpinColumn<T>[];
  rowKey: (row: T) => string | number;
  cardTitle: (row: T) => React.ReactNode;
  cardAside?: (row: T) => React.ReactNode;
  onOpen?: (row: T) => void;
  openLabel?: (row: T) => string;
  caption: string;
  busy?: boolean;
};

/*
 * Console list per the admin design notes: a fixed-layout table inside a size container, shown
 * only once the container fits the fixed columns plus 12rem; below that the same rows render as
 * cards, two-up from 40rem. Never scrolls sideways.
 */
export function SpinWinDataTable<T>({ rows, columns, rowKey, cardTitle, cardAside, onOpen, openLabel, caption, busy }: Props<T>) {
  return (
    <div className={`${styles.results} ${busy ? styles.busy : ""}`} aria-busy={busy}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{caption}</caption>
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === "right" ? styles.right : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onOpen ? styles.clickable : undefined}
              onClick={onOpen ? () => onOpen(row) : undefined}
            >
              {columns.map((c, index) => (
                <td key={c.key} className={c.align === "right" ? styles.right : undefined}>
                  {index === 0 && onOpen ? (
                    <button
                      type="button"
                      className={styles.openButton}
                      aria-label={openLabel?.(row)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(row);
                      }}
                    >
                      {c.render(row)}
                    </button>
                  ) : (
                    c.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className={styles.cards} aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className={styles.card}>
            <div className={styles.cardHead}>
              {onOpen ? (
                <button type="button" className={styles.openButton} aria-label={openLabel?.(row)} onClick={() => onOpen(row)}>
                  {cardTitle(row)}
                </button>
              ) : (
                cardTitle(row)
              )}
              {cardAside?.(row)}
            </div>
            <dl className={styles.facts}>
              {columns
                .filter((c) => !c.hideInCard)
                .map((c) => (
                  <div key={c.key}>
                    <dt>{c.header}</dt>
                    <dd>{c.render(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SpinCell = {
  Stack: ({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) => (
    <span className={styles.stack}>
      <span className={styles.primary}>{primary}</span>
      {secondary ? <span className={styles.secondary}>{secondary}</span> : null}
    </span>
  ),
  Muted: ({ children }: { children: React.ReactNode }) => <span className={styles.muted}>{children}</span>,
  Code: ({ children }: { children: React.ReactNode }) => <code className={styles.code}>{children}</code>,
};