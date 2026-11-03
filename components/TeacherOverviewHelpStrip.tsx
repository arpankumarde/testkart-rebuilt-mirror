import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Headset, Mail } from "lucide-react";
import { useTeacherRelationshipManager } from "../helpers/useTeacherRelationshipManager";
import styles from "./TeacherOverviewHelpStrip.module.css";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** The foot of the Overview: the teacher's relationship manager, guides and support, one row. */
export const TeacherOverviewHelpStrip: React.FC = () => {
  const { data } = useTeacherRelationshipManager(true);
  const manager = data?.manager;

  return (
    <section className={styles.strip} aria-labelledby="teacher-help">
      <h2 id="teacher-help" className={styles.title}>
        Need help?
      </h2>
      <ul className={styles.list}>
        {manager && (
          <li>
            <a href={`mailto:${manager.email}`} className={styles.item} title={manager.email}>
              {manager.avatarUrl ? (
                <img src={manager.avatarUrl} alt="" className={styles.avatar} />
              ) : (
                <span className={`${styles.avatar} ${styles.initials}`} aria-hidden="true">
                  {initialsOf(manager.name)}
                </span>
              )}
              <span className={styles.itemText}>
                Email {manager.name.split(/\s+/)[0]}
                <span className={styles.sub}>Your manager</span>
              </span>
              <Mail className={styles.trail} size={16} aria-hidden="true" />
            </a>
          </li>
        )}
        <li>
          <Link to="/help" target="_blank" rel="noopener noreferrer" className={styles.item}>
            <span className={styles.iconBox} aria-hidden="true">
              <BookOpen size={18} />
            </span>
            <span className={styles.itemText}>Guides</span>
          </Link>
        </li>
        <li>
          <Link to="/teacher/support" className={styles.item}>
            <span className={styles.iconBox} aria-hidden="true">
              <Headset size={18} />
            </span>
            <span className={styles.itemText}>Support</span>
          </Link>
        </li>
      </ul>
    </section>
  );
};
