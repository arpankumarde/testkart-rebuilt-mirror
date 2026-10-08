import React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import styles from "./TeacherCardInsights.module.css";

type InsightBase = { label: string; icon: LucideIcon };

/* A cell is a link, or a button when it runs an action instead of navigating. */
export type TeacherCardInsight = InsightBase &
  ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

/*
 * The strip along the bottom of a content card: shortcuts into Student
 * performance, already filtered to that item. A card whose cells are not
 * student results (a bundle's contents and unpublish) names the strip itself.
 */
export const TeacherCardInsights = ({
  items,
  itemTitle,
  ariaLabel,
}: {
  items: TeacherCardInsight[];
  itemTitle: string;
  ariaLabel?: string;
}) => (
  <nav className={styles.strip} aria-label={ariaLabel ?? `Student results for ${itemTitle}`}>
    {items.map(({ to, onClick, label, icon: Icon }) => {
      const content = (
        <>
          <Icon size={15} aria-hidden="true" />
          <span>{label}</span>
        </>
      );
      return to !== undefined ? (
        <Link key={label} to={to} className={styles.link}>
          {content}
        </Link>
      ) : (
        <button key={label} type="button" onClick={onClick} className={styles.link}>
          {content}
        </button>
      );
    })}
  </nav>
);
