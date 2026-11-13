import React, { useState } from "react";
import { Clock, Video } from "lucide-react";
import { handleClassroomLinkClick } from "../helpers/openClassroom";
import { formatClassLength } from "../helpers/livePricing";
import styles from "./LiveSession.module.css";

/*
 * Shared pieces for live teaching lists (student and teacher consoles): a
 * calendar date tile, a session row, the "Up next" card and the compact
 * session card the student list uses. Colours come from the --sp-* / --fc-*
 * palette, so both consoles and dark mode follow.
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
          {formatClassLength(durationMinutes)}
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
          {formatSessionTime(startTime, timeZone)} &middot; {formatClassLength(durationMinutes)}
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

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

/* Photo when there is one, initials otherwise. The name sits beside it, so the image is decorative. */
export const LiveSessionAvatar: React.FC<{ name: string; src?: string | null }> = ({ name, src }) => {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className={styles.avatar} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <span className={styles.avatar} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
};

/* Opens the classroom in its own tab so this list stays open behind it. */
export const LiveSessionJoinLink: React.FC<{ to: string; label?: string }> = ({ to, label = "Join classroom" }) => (
  <a href={to} target="_blank" rel="noopener noreferrer" className={styles.join} onClick={(e) => handleClassroomLinkClick(e, to)}>
    <Video size={16} aria-hidden="true" />
    {label}
  </a>
);

export const LiveSessionOpensNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className={styles.opens}>
    <Clock size={14} aria-hidden="true" />
    {children}
  </span>
);

interface CardProps {
  startTime: Date | string;
  durationMinutes: number;
  title: string;
  teacherName: string;
  teacherAvatarUrl?: string | null;
  /* "live" while the classroom is open, "next" for the first upcoming session. */
  badge?: "live" | "next" | null;
  status?: LiveSessionStatus | null;
  tag?: string | null;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  timeZone?: string;
}

/* One slim row per session: date block, title with teacher and time, then the action. */
export const LiveSessionCard: React.FC<CardProps> = ({
  startTime,
  durationMinutes,
  title,
  teacherName,
  teacherAvatarUrl,
  badge,
  status,
  tag,
  note,
  actions,
  timeZone,
}) => {
  const d = new Date(startTime);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { ...opts, timeZone }).format(d);
  const relative = relativeDayLabel(startTime, timeZone);
  const cardClass = [
    styles.card,
    badge === "live" ? styles.cardLive : badge === "next" ? styles.cardNext : "",
    status ? styles.cardSettled : "",
  ].join(" ");

  return (
    <article className={cardClass}>
      <span className={`${styles.cardDate} ${badge ? styles.cardDateActive : ""}`} aria-hidden="true">
        <span className={styles.cardMonth}>{part({ month: "short" })}</span>
        <span className={styles.cardDay}>{part({ day: "numeric" })}</span>
        <span className={styles.cardWeekday}>{part({ weekday: "short" })}</span>
      </span>

      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>{title}</h3>
          {badge === "live" && (
            <span className={`${styles.badge} ${styles.badgeLive}`}>
              <span className={styles.badgeDot} aria-hidden="true" />
              Room open
            </span>
          )}
          {badge === "next" && (
            <span className={`${styles.badge} ${styles.badgeNext}`}>
              <span className={styles.badgeDot} aria-hidden="true" />
              Up next
            </span>
          )}
          {status && <StatusChip status={status} />}
          {tag && <span className={styles.tag}>{tag}</span>}
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.cardTeacher}>
            <LiveSessionAvatar name={teacherName} src={teacherAvatarUrl} />
            <span className={styles.cardTeacherName}>{teacherName}</span>
          </span>
          <span className={styles.cardWhen}>
            <Clock size={14} aria-hidden="true" />
            <span>
              <strong className={styles.cardWhenDay}>{relative ?? formatWeekdayDate(startTime, timeZone)}</strong>
              {", "}
              {formatSessionTime(startTime, timeZone)} &middot; {formatClassLength(durationMinutes)}
            </span>
          </span>
        </div>
        {note && <p className={styles.cardNote}>{note}</p>}
      </div>

      {actions && <div className={styles.cardActions}>{actions}</div>}
    </article>
  );
};
