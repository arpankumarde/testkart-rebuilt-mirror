import React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import styles from "./TeacherCardInsights.module.css";

export type TeacherCardInsight = { to: string; label: string; icon: LucideIcon };

/*
 * The strip along the bottom of a content card: shortcuts into Student
 * performance, already filtered to that item.
 */
export const TeacherCardInsights = ({ items, itemTitle }: { items: TeacherCardInsight[]; itemTitle: string }) => (
  <nav className={styles.strip} aria-label={`Student results for ${itemTitle}`}>
    {items.map(({ to, label, icon: Icon }) => (
      <Link key={label} to={to} className={styles.link}>
        <Icon size={15} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    ))}
  </nav>
);
