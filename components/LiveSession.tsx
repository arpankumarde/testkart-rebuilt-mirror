import React from "react";
import { Clock } from "lucide-react";
import styles from "./LiveSession.module.css";

/*
 * Shared pieces for live teaching lists (student and teacher consoles): a
 * calendar date tile, a session row and the "Up next" card. Colours come from
 * the --sp-* / --fc-* palette, so both consoles and dark mode follow.
 */

export type LiveSessionTone = "lavender" | "blue" | "sage" | "butter" | "mint" | "peach" | "muted";

export type LiveSessionStatus = {
  label: string;
  tone: "mint" | "peach" | "sage" | "butter" | "muted";
};

const toneClass = (tone: LiveSessionTone) => styles[`tone_${tone}`];

const sameDay = (a: Date, b: Date, timeZone?: string) => {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(a) === fmt.format(b);
};

/* "Today" / "Tomorrow" for the next two days, otherwise null. */
export const relativeDayLabel = (date: Date | string, timeZone?: string): string | null => {
  const d = new Date(date);
  const now = new Date();
  if (sameDay(d, now, timeZone)) return "Today";
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (sameDay(d, tomorrow, timeZone)) return "Tomorrow";
  return null;
};

export const formatSessionTime = (date: Date | string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone }).format(new Date(date));

const formatWeekdayDate = (date: Date | string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(date));

interface DateTileProps {
  date: Date | string;
  tone?: LiveSessionTone;
  size?: "md" | "lg";
  timeZone?: string;
  className?: string;
}

export const LiveSessionDateTile: React.FC<DateTileProps> = ({ date, tone = "lavender", size = "md", timeZone, className }) => {
  const d = new Date(date);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...opts, timeZone }).format(d);
  return (
    <span
      className={`${styles.dateTile} ${size === "lg" ? styles.dateTileLg : ""} ${toneClass(tone)} ${className ?? ""}`}
      aria-hidden="true"
    >
      <span className={styles.dateMonth}>{part({ month: "short" })}</span>
      <span className={styles.dateDay}>{part({ day: "numeric" })}</span>
      <span className={styles.dateWeekday}>{part({ weekday: "short" })}</span>
    </span>
  );
};

const StatusChip: React.FC<{ status: LiveSessionStatus }> = ({ status }) => (
  <span className={`${styles.status} ${styles[`status_${status.tone}`]}`}>{status.label}</span>
);

interface RowProps {
  startTime: Date | string;
  durationMinutes: number;
  title: string;
  subtitle?: React.ReactNode;
  tone?: LiveSessionTone;
  status?: LiveSessionStatus | null;
  note?: React.ReactNode;
  extra?: React.ReactNode;
  actions?: React.ReactNode;
  timeZone?: string;
  className?: string;
}

export const LiveSessionRow: React.FC<RowProps> = ({
  startTime,
  durationMinutes,
  title,
  subtitle,
  tone = "lavender",
  status,
  note,
  extra,
  actions,
  timeZone,
  className,
}) => {
  const relative = relativeDayLabel(startTime, timeZone);
  return (
    <article className={`${styles.row} ${className ?? ""}`}>
      <LiveSessionDateTile date={startTime} tone={status ? "muted" : tone} timeZone={timeZone} />
      <div className={styles.rowBody}>
        <div className={styles.rowHead}>
          <h3 className={styles.rowTitle}>{title}</h3>
          {status && <StatusChip status={status} />}
        </div>
        {subtitle && <p className={styles.rowSubtitle}>{subtitle}</p>}
        <p className={styles.rowMeta}>
          <Clock size={13} aria-hidden="true" />
          {relative ? <strong className={styles.relative}>{relative}</strong> : formatWeekdayDate(startTime, timeZone)}
          <span aria-hidden="true">&middot;</span>
          {formatSessionTime(startTime, timeZone)}
          <span aria-hidden="true">&middot;</span>
          {durationMinutes} min
        </p>
        {extra}
        {note && <p className={styles.rowNote}>{note}</p>}
      </div>
      {actions && <div className={styles.rowActions}>{actions}</div>}
    </article>
  );
};

interface NextCardProps {
  startTime: Date | string;
  durationMinutes: number;
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
  timeZone?: string;
}

export const LiveSessionNextCard: React.FC<NextCardProps> = ({
  startTime,
  durationMinutes,
  title,
  subtitle,
  eyebrow = "Up next",
  actions,
  timeZone,
}) => {
  const relative = relativeDayLabel(startTime, timeZone);
  return (
    <section className={styles.next} aria-label={eyebrow}>
      <LiveSessionDateTile date={startTime} tone="peach" size="lg" timeZone={timeZone} className={styles.nextTile} />
      <div className={styles.nextBody}>
        <span className={styles.nextEyebrow}>{eyebrow}</span>
        <h2 className={styles.nextTitle}>{title}</h2>
        {subtitle && <p className={styles.nextSubtitle}>{subtitle}</p>}
        <p className={styles.nextMeta}>
          <Clock size={15} aria-hidden="true" />
          {relative ? `${relative}, ` : `${formatWeekdayDate(startTime, timeZone)}, `}
          {formatSessionTime(startTime, timeZone)} &middot; {durationMinutes} min
        </p>
      </div>
      {actions && <div className={styles.nextActions}>{actions}</div>}
    </section>
  );
};

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  variant?: "segment" | "pills";
}

/* A row of toggle buttons: a two-way segment for the session kind, pills for the time filter. */
export function LiveSessionSegment<T extends string>({ value, options, onChange, label, variant = "segment" }: SegmentProps<T>) {
  return (
    <div className={variant === "segment" ? styles.segment : styles.pills} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${variant === "segment" ? styles.segmentButton : styles.pill} ${value === option.value ? styles.active : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const LiveSessionList: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className={styles.list}>
    {title && <h2 className={styles.listTitle}>{title}</h2>}
    {children}
  </section>
);
