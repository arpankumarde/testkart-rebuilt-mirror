import React from "react";
import { ListFilter, X } from "lucide-react";
import { Button } from "./Button";
import styles from "./ConsoleFilterNotice.module.css";

interface ConsoleFilterNoticeProps {
  /* What the list is narrowed to, as a phrase: "Published courses with no lessons". */
  label: React.ReactNode;
  /* Rows left after every filter on the page. Omit when the list is paginated and the total is unknown. */
  count?: number;
  onClear: () => void;
  clearLabel?: string;
  className?: string;
}

/*
 * Names a filter that has no control of its own on the page - usually one a
 * dashboard tile linked to - so a narrowed list never passes for the whole
 * list, and gives one way back out of it. Sits between the toolbar and the
 * results.
 */
export const ConsoleFilterNotice: React.FC<ConsoleFilterNoticeProps> = ({
  label,
  count,
  onClear,
  clearLabel = "Clear filter",
  className,
}) => (
  <div className={`${styles.notice} ${className ?? ""}`} role="status">
    <span className={styles.icon} aria-hidden="true">
      <ListFilter size={16} />
    </span>
    <p className={styles.text}>
      <span className={styles.prefix}>Filtered to</span>
      <span className={styles.label}>{label}</span>
      {typeof count === "number" && <span className={styles.count}>{count.toLocaleString("en-IN")}</span>}
    </p>
    <Button variant="outline" size="sm" onClick={onClear} className={styles.clear}>
      <X size={14} aria-hidden="true" />
      {clearLabel}
    </Button>
  </div>
);