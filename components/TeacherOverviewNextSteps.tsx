import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookCopy, BookOpen, FileText, Package, UserPlus } from "lucide-react";
import type { User } from "../helpers/User";
import styles from "./TeacherOverviewNextSteps.module.css";

type Props = {
  user: User;
  /** Published tests + courses + study notes + bundles, all time. */
  publishedCount: number;
  className?: string;
};

/**
 * The six things that make a teacher's public page worth landing on. Kept to
 * six so the bar moves visibly with one edit — a longer checklist reads as a
 * chore and never reaches 100%.
 */
const profileChecks = (user: User) => [
  { key: "photo", label: "Photo", done: Boolean(user.avatarUrl) },
  { key: "tagline", label: "Tagline", done: Boolean(user.tagline?.trim()) },
  { key: "bio", label: "About you", done: Boolean(user.bio?.trim()) },
  { key: "expertise", label: "Exams you teach", done: (user.expertiseAreas?.length ?? 0) > 0 },
  { key: "languages", label: "Languages", done: (user.languages?.length ?? 0) > 0 },
  {
    key: "links",
    label: "A link students can follow",
    done: Boolean(user.websiteUrl?.trim()) || Object.values(user.socialLinks ?? {}).some((v) => Boolean(v)),
  },
];

const CREATE_ACTIONS = [
  { to: "/teacher/create-test", label: "Test series", icon: BookCopy },
  { to: "/teacher/courses/create", label: "Course", icon: BookOpen },
  { to: "/teacher/products/create", label: "Study notes", icon: FileText },
  { to: "/teacher/bundles/create", label: "Bundle", icon: Package },
  { to: "/teacher/students", label: "Sponsor a student", icon: UserPlus },
];

export const TeacherOverviewNextSteps = ({ user, publishedCount, className }: Props) => {
  const checks = profileChecks(user);
  const done = checks.filter((check) => check.done).length;
  const missing = checks.filter((check) => !check.done);
  const percent = Math.round((done / checks.length) * 100);

  // The public profile belongs to the academy owner, and a team manager edits
  // their own record rather than that one — so only the owner gets nagged
  // about it. Same split the sidebar already makes for Settings and Earnings.
  const showProfile = missing.length > 0 && user.teacherRole !== "manager";

  return (
    <div className={`${styles.row} ${showProfile ? "" : styles.rowSingle} ${className ?? ""}`.trim()}>
      {showProfile && (
        <section className={styles.card} aria-label="Complete your profile">
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Complete your profile</h2>
            <span className={styles.percent}>{percent}%</span>
          </div>
          <div
            className={styles.meter}
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={checks.length}
            aria-label={`${done} of ${checks.length} profile items done`}
          >
            <span className={styles.meterFill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.cardText}>
            Students see this before they buy. Still to add:{" "}
            <strong className={styles.missing}>{missing.map((check) => check.label).join(", ")}</strong>.
          </p>
          <Link to="/teacher/edit-profile" className={styles.primaryAction}>
            Finish profile
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
      )}

      <section className={styles.card} aria-label="Add to your catalogue">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>
            {publishedCount === 0 ? "Publish your first listing" : "Add to your catalogue"}
          </h2>
        </div>
        <p className={styles.cardText}>
          {publishedCount === 0
            ? "Nothing is live yet, so there is nothing for students to buy. Start with a test series."
            : "The more you have live, the more there is to find and buy."}
        </p>
        <div className={styles.actions}>
          {CREATE_ACTIONS.map((action) => (
            <Link key={action.to} to={action.to} className={styles.action}>
              <action.icon size={15} aria-hidden="true" />
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
