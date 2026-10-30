import React from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  CalendarClock,
  CalendarPlus,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock3,
  Hourglass,
  RefreshCw,
} from "lucide-react";
import type { GecStatusBadge, GecStatusTone, GecTable } from "../helpers/gecView";
import { daysUntil, isFiltering, rowMatches, type GecFilters } from "../helpers/govtExamsCalendarFilter";
import styles from "./GovtExamsTable.module.css";

const TONE_ICON: Record<GecStatusTone, React.ElementType> = {
  open: CircleCheck,
  upcoming: Clock3,
  progress: CircleDot,
  concluded: CircleDashed,
  awaited: Hourglass,
  tentative: CalendarClock,
  revised: RefreshCw,
  extended: CalendarPlus,
};

export const GovtExamsStatus: React.FC<{ status: GecStatusBadge }> = ({ status }) => {
  const Icon = TONE_ICON[status.tone];
  return (
    <span className={`${styles.status} ${styles[status.tone]}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      {status.label}
    </span>
  );
};

const deadlineNote = (days: number) => {
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  return days === 1 ? "1 day left" : `${days} days left`;
};

/**
 * The last date as a chip. Red with a countdown at `urgentDays` or fewer, grey "Closed" once
 * past. `today` is null on the server and on first paint, so SSR and hydration agree.
 */
export const GovtExamsDeadline: React.FC<{ label: string; deadline: string; today: string | null; urgentDays: number }> = ({
  label,
  deadline,
  today,
  urgentDays,
}) => {
  const days = today ? daysUntil(deadline, today) : null;
  const urgent = days !== null && days >= 0 && days <= urgentDays;
  const closed = days !== null && days < 0;
  return (
    <span className={styles.deadlineWrap}>
      <span className={`${styles.deadline} ${urgent ? styles.deadlineUrgent : ""} ${closed ? styles.deadlineClosed : ""}`}>
        {urgent && <AlarmClock size={14} strokeWidth={2.5} aria-hidden="true" />}
        {label}
      </span>
      {(urgent || closed) && (
        <span className={`${styles.deadlineNote} ${urgent ? styles.deadlineNoteUrgent : ""}`}>{deadlineNote(days!)}</span>
      )}
    </span>
  );
};

/** A cell's text, linked when the row carries a link for it: internal pages in-app, official sites in a new tab. */
const CellText: React.FC<{ text: string; href: string | null | undefined }> = ({ text, href }) => {
  if (!href) return <>{text}</>;
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={styles.cellLink}>
        {text}
      </Link>
    );
  }
  return (
    <a href={href} className={styles.cellLink} target="_blank" rel="noopener noreferrer nofollow">
      {text}
    </a>
  );
};

interface GovtExamsTableProps {
  table: GecTable;
  filters: GecFilters;
  today: string | null;
  urgentDays: number;
  onClearFilters: () => void;
  /** Extra content under the table, such as a legend. */
  children?: React.ReactNode;
}

/** One calendar section: H2, intro, the filtered table in its own sideways scroller, then the note. */
export const GovtExamsTable: React.FC<GovtExamsTableProps> = ({ table, filters, today, urgentDays, onClearFilters, children }) => {
  const titleId = `${table.id}-title`;
  const rows = table.rows.filter((row) => rowMatches(table, row, filters));
  const filtering = isFiltering(filters);
  const dataColumns = table.statusColumn ? table.columns.slice(0, -1) : table.columns;

  return (
    <section id={table.id} data-gec-section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {table.title}
        </h2>
        {filtering && (
          <span className={styles.count}>
            {rows.length} of {table.rows.length} shown
          </span>
        )}
      </div>
      {table.intro && <p className={styles.intro}>{table.intro}</p>}

      {table.rows.length === 0 ? (
        <div className={styles.empty}>
          <p>Nothing to list here right now. Check back after the next update.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          <p>Nothing in this table matches your search and filters.</p>
          <button type="button" className={styles.emptyClear} onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.scroll} role="region" aria-labelledby={titleId} tabIndex={0}>
          <table className={styles.table}>
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
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">
                    {row.deadline ? (
                      <GovtExamsDeadline label={row.cells[0]} deadline={row.deadline} today={today} urgentDays={urgentDays} />
                    ) : (
                      <CellText text={row.cells[0]} href={row.links[0]} />
                    )}
                  </th>
                  {dataColumns.slice(1).map((column, index) => (
                    <td key={column}>
                      <CellText text={row.cells[index + 1]} href={row.links[index + 1]} />
                    </td>
                  ))}
                  {table.statusColumn && <td>{row.status && <GovtExamsStatus status={row.status} />}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {children}
      {table.note && <p className={styles.note}>{table.note}</p>}
    </section>
  );
};