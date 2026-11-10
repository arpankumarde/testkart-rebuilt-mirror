import React from "react";
import styles from "./AdminLiveEmptyState.module.css";

type Tone = "mint" | "lavender" | "powder" | "peach" | "butter";

interface AdminLiveEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  tone?: Tone;
  action?: React.ReactNode;
  compact?: boolean;
}

/* Empty and error states on the admin live lessons page: an icon medallion with two confetti dots. */
export const AdminLiveEmptyState: React.FC<AdminLiveEmptyStateProps> = ({
  icon,
  title,
  description,
  tone = "lavender",
  action,
  compact = false,
}) => (
  <div className={`${styles.wrap} ${compact ? styles.compact : ""}`} role="status">
    <div className={`${styles.art} ${styles[tone]}`} aria-hidden="true">
      <span className={styles.ring} />
      <span className={styles.medallion}>{icon}</span>
      <span className={`${styles.dot} ${styles.dotA}`} />
      <span className={`${styles.dot} ${styles.dotB}`} />
    </div>
    <div className={styles.text}>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
    {action ? <div className={styles.action}>{action}</div> : null}
  </div>
);