import React from "react";
import styles from "./ConsoleListEmpty.module.css";

interface ConsoleListEmptyProps {
  /* A lucide icon element. Shown in a brand-tinted circle. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /* The recovery action - create, retry, clear the search. */
  children?: React.ReactNode;
  tone?: "default" | "error";
  className?: string;
}

/*
 * The surface panel every console list falls back to when it has nothing to
 * show. An error state is the same panel announced to assistive tech.
 *
 * TeacherListEmpty re-exports this.
 */
export const ConsoleListEmpty: React.FC<ConsoleListEmptyProps> = ({
  icon,
  title,
  description,
  children,
  tone = "default",
  className,
}) => (
  <div
    className={`${styles.empty} ${className ?? ""}`}
    role={tone === "error" ? "alert" : undefined}
  >
    {icon ? (
      <span
        className={`${styles.icon} ${tone === "error" ? styles.iconError : ""}`}
        aria-hidden="true"
      >
        {icon}
      </span>
    ) : null}
    <h2 className={styles.title}>{title}</h2>
    {description ? <p className={styles.text}>{description}</p> : null}
    {children ? <div className={styles.actions}>{children}</div> : null}
  </div>
);
