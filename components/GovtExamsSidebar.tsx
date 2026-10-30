import React from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, FileDown, ListChecks } from "lucide-react";
import type { GecPageContent, GecSectionId } from "../helpers/gecModel";
import styles from "./GovtExamsSidebar.module.css";

interface GovtExamsSidebarProps {
  items: { id: GecSectionId; label: string }[];
  card: GecPageContent["sidebar"];
  active: GecSectionId | null;
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, id: GecSectionId) => void;
}

/** Desktop-only sticky sidebar: On this page, the mock test card and Get updates (both update actions are still to come). */
export const GovtExamsSidebar: React.FC<GovtExamsSidebarProps> = ({ items, card, active, onNavigate }) => (
  <aside className={styles.sidebar} aria-label="Page tools">
    <nav className={styles.card} aria-labelledby="gec-toc-title">
      <h2 id="gec-toc-title" className={styles.cardTitle}>
        On this page
      </h2>
      <ul className={styles.toc}>
        {items.map(({ id, label }) => (
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
        {card.title}
      </h2>
      {card.text && <p className={styles.cardText}>{card.text}</p>}
      {card.url ? (
        card.url.startsWith("/") ? (
          <Link to={card.url} className={styles.mockButton}>
            {card.buttonLabel}
          </Link>
        ) : (
          <a href={card.url} className={styles.mockButton} target="_blank" rel="noopener noreferrer">
            {card.buttonLabel}
          </a>
        )
      ) : (
        <span className={styles.mockButton}>{card.buttonLabel}</span>
      )}
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