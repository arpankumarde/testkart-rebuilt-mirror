import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import styles from "./TeacherFormHeader.module.css";

interface TeacherFormHeaderProps {
  /* Where the back link goes. Omit `backTo` and pass `onBack` for a form that
     has to run its own handler instead of navigating. */
  backTo?: string;
  onBack?: () => void;
  /* The destination's name - "Test series", "Live tests". Not "Back to X": the
     arrow already carries that. */
  backLabel?: string;
  title: string;
  /* Form pages take a subtitle, unlike the list pages - it says what this step
     produces, which the sidebar cannot. */
  subtitle?: React.ReactNode;
  /* Page-level actions, right-aligned on the title row. */
  children?: React.ReactNode;
  className?: string;
}

/*
 * The header every teacher create/edit page opens with. teacher.create-test set
 * the pattern - a back link naming its destination, then a left-aligned h1 at
 * the console's title scale, then one line saying what the form is for. Before
 * this, the nine form pages between them used three different back controls,
 * four title sizes and two alignments.
 */
export const TeacherFormHeader: React.FC<TeacherFormHeaderProps> = ({
  backTo,
  onBack,
  backLabel,
  title,
  subtitle,
  children,
  className,
}) => (
  <header className={`${styles.header} ${className ?? ""}`}>
    {backLabel && (backTo || onBack) ? (
      backTo ? (
        <Link to={backTo} className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" />
          {backLabel}
        </Link>
      ) : (
        <button type="button" onClick={onBack} className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" />
          {backLabel}
        </button>
      )
    ) : null}

    <div className={styles.titleRow}>
      <h1 className={styles.title}>{title}</h1>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>

    {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
  </header>
);
