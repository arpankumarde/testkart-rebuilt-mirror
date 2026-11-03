import React from "react";
import styles from "./ConsolePageHeader.module.css";

interface ConsolePageHeaderProps {
  title: string;
  /* One optional line under the title. Most console pages leave it out. */
  description?: string;
  /* Drawn before the title, e.g. the teacher console's content-kind tile. */
  leading?: React.ReactNode;
  /* Page-level actions, rendered right-aligned on the title row. */
  children?: React.ReactNode;
  className?: string;
}

/*
 * The single title row every console page opens with - admin, teacher and
 * student alike. One h1, actions on the right, and an optional one-line
 * description for pages that need to say what they are for.
 *
 * TeacherPageHeader re-exports this, so the two consoles cannot drift apart.
 */
export const ConsolePageHeader: React.FC<ConsolePageHeaderProps> = ({
  title,
  description,
  leading,
  children,
  className,
}) => {
  const heading = description ? (
    <div className={styles.titleText}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </div>
  ) : (
    <h1 className={styles.title}>{title}</h1>
  );

  return (
    <header className={`${styles.header} ${className ?? ""}`}>
      {leading ? (
        <div className={styles.titleRow}>
          {leading}
          {heading}
        </div>
      ) : (
        heading
      )}
      {children ? <div className={styles.actions}>{children}</div> : null}
    </header>
  );
};
