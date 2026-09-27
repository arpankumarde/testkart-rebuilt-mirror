import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { initials, marksText, scoreText, SortDirection } from "../helpers/teacherPerformanceFormat";
import type { AttemptMarks } from "../helpers/teacherPerformance";
import styles from "./TeacherPerformanceKit.module.css";

/* The Performance tabs share one table and figure language; they import these classes. */
export const perfStyles = styles;

/**
 * The student's profile photo, or their initials when there is none or it
 * fails to load. Google photos refuse requests that carry a referrer.
 */
export const StudentPhoto = ({ name, url, large }: { name: string; url: string | null | undefined; large?: boolean }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [url]);
  const className = `${styles.avatar} ${large ? styles.avatarLarge : ""}`;
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        className={`${className} ${styles.avatarImage}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className={className} aria-hidden="true">
      {initials(name)}
    </span>
  );
};

export const StudentName = ({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) => (
  <span className={styles.name}>
    <StudentPhoto name={name} url={avatarUrl} />
    <span className={styles.nameText}>{name}</span>
  </span>
);

/** Spread on a tr to make the whole row open something. Pair it with OpenCell, which carries focus and the name. */
export const openRow = (onOpen?: (() => void) | null) =>
  onOpen ? { className: styles.rowLink, onClick: onOpen } : {};

export const OpenCell = ({ label, onOpen }: { label: string; onOpen?: (() => void) | null }) => (
  <td className={styles.openCell}>
    {onOpen ? (
      <button
        type="button"
        className={styles.openButton}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    ) : null}
  </td>
);

export const OpenHead = () => (
  <th className={styles.openCell}>
    <span className={styles.srOnly}>Open</span>
  </th>
);

/** Net marks out of the maximum, with what was earned and what negative marking took away underneath. */
export const MarksCell = ({ marks, max }: { marks: AttemptMarks | null | undefined; max: number | null | undefined }) => {
  if (!marks) return <span className={styles.none}>-</span>;
  return (
    <span className={styles.marks}>
      <span className={`${styles.marksNet} ${marks.net < 0 ? styles.negative : ""}`}>
        {marksText(marks.net)}
        {max ? <span className={styles.marksMax}> / {marksText(max)}</span> : null}
      </span>
      {marks.lost > 0 ? (
        <span className={styles.marksSplit}>
          <span className={styles.plus}>+{marksText(marks.gained)}</span>
          <span className={styles.minus}>-{marksText(marks.lost)}</span>
        </span>
      ) : null}
    </span>
  );
};

/** A percentage with a bar scaled to 100. Below-zero scores (negative marking) show an empty bar and red text. */
export const ScoreBar = ({ value }: { value: number | null | undefined }) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={styles.none}>-</span>;
  }
  const width = Math.max(0, Math.min(100, value));
  return (
    <span className={styles.meter}>
      <span className={`${styles.meterValue} ${value < 0 ? styles.negative : ""}`}>{scoreText(value)}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${width}%` }} />
      </span>
    </span>
  );
};

export const ProgressBar = ({ value, caption }: { value: number | null | undefined; caption?: string }) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={styles.none}>-</span>;
  }
  const width = Math.max(0, Math.min(100, value));
  return (
    <span className={styles.meter}>
      <span className={styles.meterValue}>{scoreText(value)}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={`${styles.fill} ${width >= 100 ? styles.fillDone : ""}`} style={{ width: `${width}%` }} />
      </span>
      {caption ? <span className={styles.meterCaption}>{caption}</span> : null}
    </span>
  );
};

export const RankBadge = ({ rank }: { rank: number | null | undefined }) => {
  if (!rank) return <span className={styles.none}>-</span>;
  const tone = rank === 1 ? styles.rank1 : rank === 2 ? styles.rank2 : rank === 3 ? styles.rank3 : styles.rankOther;
  return (
    <span className={`${styles.rank} ${tone}`} aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  );
};

/** A column header button. aria-sort goes on the th, which the caller renders. */
export const SortHeader = ({
  label,
  active,
  direction,
  onSort,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
}) => {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" className={`${styles.sort} ${active ? styles.sortActive : ""}`} onClick={onSort}>
      {label}
      <Icon size={13} aria-hidden="true" />
    </button>
  );
};

export const ariaSort = (active: boolean, direction: SortDirection): "ascending" | "descending" | "none" =>
  !active ? "none" : direction === "asc" ? "ascending" : "descending";

export type PerformanceFact = { label: string; value: string; note?: string };

/** flat drops the strip's own frame, for use inside a panel. */
export const PerformanceFacts = ({ items, busy, flat }: { items: PerformanceFact[]; busy?: boolean; flat?: boolean }) => (
  <dl className={`${styles.facts} ${flat ? styles.factsFlat : ""} ${busy ? styles.busy : ""}`} aria-busy={busy}>
    {items.map((item) => (
      <div key={item.label} className={styles.fact}>
        <dt>{item.label}</dt>
        <dd>
          {item.value}
          {item.note ? <span className={styles.factNote}>{item.note}</span> : null}
        </dd>
      </div>
    ))}
  </dl>
);
