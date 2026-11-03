import React from "react";
import styles from "./TeacherStatusPill.module.css";

export type TeacherItemStatus = "live" | "draft" | "review" | "rejected" | "scheduled";

const LABELS: Record<TeacherItemStatus, string> = {
  live: "Live",
  draft: "Draft",
  review: "In review",
  rejected: "Changes requested",
  scheduled: "Scheduled",
};

type Props = {
  status: TeacherItemStatus;
  /** Overrides the default word, e.g. "Ended" on a scheduled pill. */
  label?: string;
  className?: string;
};

/** Dot, word and colour together, so no status is told by colour alone. */
export const TeacherStatusPill = ({ status, label, className }: Props) => (
  <span className={`${styles.pill} ${styles[status]} ${className ?? ""}`.trim()}>
    <span className={styles.dot} aria-hidden="true" />
    {label ?? LABELS[status]}
  </span>
);