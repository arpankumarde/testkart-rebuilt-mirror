import React from "react";
import { CalendarPlus, FileDown, ListChecks } from "lucide-react";
import { GEC_ON_THIS_PAGE, type GecSectionId } from "../helpers/govtExamsCalendarData";
import styles from "./GovtExamsSidebar.module.css";

interface GovtExamsSidebarProps {
  active: GecSectionId | null;
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, id: GecSectionId) => void;
}

/**
 * Desktop-only sticky sidebar: On this page, a mock test card and Get updates. The mock
 * test button and both update actions are placeholders until their targets exist.
 */
export const GovtExamsSidebar: React.FC<GovtExamsSidebarProps> = ({ active, onNavigate }) => (
  <aside className={styles.sidebar} aria-label="Page tools">
    <nav className={styles.card} aria-labelledby="gec-toc-title">
      <h2 id="gec-toc-title" className={styles.cardTitle}>
        On this page
      </h2>
      <ul className={styles.toc}>
        {GEC_ON_THIS_PAGE.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={`${styles.tocLink} ${active === id ? styles.tocActive : ""}`}
              aria-current={active === id ? "location" : undefined}
              onClick={(event) => onNavigate(event, id)}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>

    <section className={`${styles.card} ${styles.mockCard}`} aria-labelledby="gec-mock-title">
      <span className={styles.mockIcon} aria-hidden="true">
        <ListChecks size={22} strokeWidth={2.25} />
      </span>
      <h2 id="gec-mock-title" className={styles.cardTitle}>
        Free mock test
      </h2>
      <p className={styles.cardText}>See where you stand before exam day, in the real exam format.</p>
      <button type="button" className={styles.mockButton}>
        Try a free mock test
      </button>
    </section>

    <section className={styles.card} aria-labelledby="gec-updates-title">
      <h2 id="gec-updates-title" className={styles.cardTitle}>
        Get updates
      </h2>
      <p className={styles.cardText}>Keep these dates with you.</p>
      <div className={styles.updates}>
        <button type="button" className={styles.updateButton} aria-disabled="true">
          <CalendarPlus size={16} aria-hidden="true" />
          Add to calendar (.ics)
          <span className={styles.soon}>Soon</span>
        </button>
        <button type="button" className={styles.updateButton} aria-disabled="true">
          <FileDown size={16} aria-hidden="true" />
          Download PDF
          <span className={styles.soon}>Soon</span>
        </button>
      </div>
    </section>
  </aside>
);
