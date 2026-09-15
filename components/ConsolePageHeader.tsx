import React from "react";
import styles from "./ConsolePageHeader.module.css";

interface ConsolePageHeaderProps {
  title: string;
  /* Page-level actions, rendered right-aligned on the title row. */
  children?: React.ReactNode;
  className?: string;
}

/*
 * The single title row every console page opens with - admin, teacher and
 * student alike. One h1, actions on the right, no subtitle: the sidebar
 * already says which section you are in.
 *
 * TeacherPageHeader re-exports this, so the two consoles cannot drift apart.
 */
export const ConsolePageHeader: React.FC<ConsolePageHeaderProps> = ({
  title,
  children,
  className,
}) => (
  <header className={`${styles.header} ${className ?? ""}`}>
    <h1 className={styles.title}>{title}</h1>
    {children ? <div className={styles.actions}>{children}</div> : null}
  </header>
);
