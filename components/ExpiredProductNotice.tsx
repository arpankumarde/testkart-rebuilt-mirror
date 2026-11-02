import React from "react";
import { CalendarX } from "lucide-react";
import styles from "./ExpiredProductNotice.module.css";

interface ExpiredProductNoticeProps {
  className?: string;
}

/** Stands in for the purchase actions on a public detail page once the item has expired. */
export const ExpiredProductNotice: React.FC<ExpiredProductNoticeProps> = ({ className }) => (
  <div className={`${styles.notice} ${className ?? ""}`} role="status">
    <span className={styles.icon} aria-hidden="true">
      <CalendarX size={18} />
    </span>
    <div className={styles.body}>
      <p className={styles.title}>No longer available</p>
      <p className={styles.text}>This product has expired and can no longer be purchased.</p>
    </div>
  </div>
);