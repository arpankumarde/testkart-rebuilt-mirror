import React from "react";
import type { MasterclassPhase } from "../helpers/masterclassDisplay";
import styles from "./MasterclassStatusBadge.module.css";

const LABELS: Record<MasterclassPhase, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface MasterclassStatusBadgeProps {
  phase: MasterclassPhase;
  /** Fixed light colours for a badge laid over a cover image, in both themes. */
  onMedia?: boolean;
  className?: string;
}

export const MasterclassStatusBadge = ({ phase, onMedia = false, className }: MasterclassStatusBadgeProps) => (
  <span
    className={[styles.badge, styles[phase], onMedia ? styles.onMedia : "", className ?? ""].join(" ").trim()}
    data-phase={phase}
  >
    <span className={styles.dot} aria-hidden="true" />
    {LABELS[phase]}
  </span>
);