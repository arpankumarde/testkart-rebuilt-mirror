import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { CircleAlert, CircleCheck, Send } from "lucide-react";
import { Button } from "./Button";
import { GecPublishDialog } from "./GecPublishDialog";
import { GEC_ADMIN_PATH } from "../helpers/gecModel";
import { gecDay } from "../helpers/gecView";
import { adminFormat } from "../helpers/adminFormat";
import { useAdminGecMeta } from "../helpers/useAdminGovtExamsCalendar";
import styles from "./GecAdminHeader.module.css";

const LINKS = [
  { to: GEC_ADMIN_PATH, label: "Exam records", end: true },
  { to: `${GEC_ADMIN_PATH}/content`, label: "Page content", end: false },
  { to: `${GEC_ADMIN_PATH}/preview`, label: "Preview", end: false },
];

interface GecAdminHeaderProps {
  /** Page actions on the title row, before Publish. */
  children?: React.ReactNode;
  beforePublish?: () => Promise<void>;
}

/** Title, publish status and the section switcher shared by every Govt Exams Calendar admin page. */
export const GecAdminHeader: React.FC<GecAdminHeaderProps> = ({ children, beforePublish }) => {
  const { data: meta } = useAdminGecMeta();
  const [publishing, setPublishing] = useState(false);
  const pending = meta?.pendingChanges ?? 0;

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Government Exams Calendar</h1>
          <p className={styles.subtitle}>Manage exam schedules, application deadlines and recruitment updates.</p>
        </div>
        <div className={styles.actions}>
          {children}
          <Button onClick={() => setPublishing(true)}>
            <Send size={16} /> Publish changes
          </Button>
        </div>
      </div>

      <div className={styles.status}>
        {meta?.publication ? (
          <span className={styles.stamp}>
            Public page last updated <strong>{gecDay(meta.publication.lastUpdated)}</strong>
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
            published {adminFormat.relativeTime(meta.publication.publishedAt)}
            {meta.publication.publishedBy ? ` by ${meta.publication.publishedBy}` : ""}
          </span>
        ) : (
          <span className={styles.stamp}>{meta ? "Not published yet" : "Loading status..."}</span>
        )}
        {meta && (
          <span className={`${styles.pill} ${pending ? styles.pillPending : styles.pillClean}`}>
            {pending ? <CircleAlert size={14} aria-hidden="true" /> : <CircleCheck size={14} aria-hidden="true" />}
            {pending ? `${pending} unpublished change${pending === 1 ? "" : "s"}` : "Draft matches the live page"}
          </span>
        )}
      </div>

      <nav className={styles.nav} aria-label="Calendar sections">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ""}`}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <GecPublishDialog open={publishing} onOpenChange={setPublishing} beforePublish={beforePublish} />
    </header>
  );
};