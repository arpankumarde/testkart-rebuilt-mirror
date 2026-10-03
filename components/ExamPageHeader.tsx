import React from "react";
import styles from "./ExamPageHeader.module.css";

interface ExamPageHeaderProps {
  // Small pill above the title — the exam's category on every exam page.
  badge?: string | null;
  title: string;
  description?: string | null;
  // Compact pill buttons (Share, Print), shown top-right on desktop.
  actions?: React.ReactNode;
  // The product tabs (ExamProductTabs), attached flush to the header's
  // bottom edge so the two read as one card. Renders nothing when the exam
  // has no products, and the card simply ends after the header.
  tabs?: React.ReactNode;
}

// The one header used by every /exams/:examSlug page (Overview, the product
// listing tabs and the Important Links content pages), so they share the
// same layout, type scale, spacing and surface.
export const ExamPageHeader: React.FC<ExamPageHeaderProps> = ({ badge, title, description, actions, tabs }) => (
  <div className={styles.root}>
    <header className={styles.header}>
      <div className={styles.content}>
        {badge && <span className={styles.badge}>{badge}</span>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
    {tabs}
  </div>
);
