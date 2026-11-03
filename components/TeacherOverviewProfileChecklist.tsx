import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, UserRound } from "lucide-react";
import type { User } from "../helpers/User";
import styles from "./TeacherOverviewProfileChecklist.module.css";

/**
 * The six things that make a teacher's public page worth landing on. Kept to
 * six so the bar moves visibly with one edit - a longer checklist reads as a
 * chore and never reaches 100%.
 */
const profileChecks = (user: User) => [
  { key: "photo", label: "Photo", done: Boolean(user.avatarUrl) },
  { key: "tagline", label: "Tagline", done: Boolean(user.tagline?.trim()) },
  { key: "bio", label: "About you", done: Boolean(user.bio?.trim()) },
  { key: "expertise", label: "Exams", done: (user.expertiseAreas?.length ?? 0) > 0 },
  { key: "languages", label: "Languages", done: (user.languages?.length ?? 0) > 0 },
  {
    key: "links",
    label: "Social link",
    done: Boolean(user.websiteUrl?.trim()) || Object.values(user.socialLinks ?? {}).some((v) => Boolean(v)),
  },
];

/**
 * A one-line profile progress bar, shown to academy owners until all six are
 * done. A team manager edits their own record, not the academy's public page,
 * so they never see it.
 */
export const TeacherOverviewProfileChecklist = ({ user }: { user: User }) => {
  if (user.teacherRole === "manager") return null;
  const checks = profileChecks(user);
  const done = checks.filter((check) => check.done).length;
  if (done === checks.length) return null;
  const missing = checks.filter((check) => !check.done).map((check) => check.label);

  return (
    <section className={styles.card} aria-labelledby="teacher-profile-checklist">
      <Link to="/teacher/edit-profile" className={styles.link}>
        <span className={styles.icon} aria-hidden="true">
          <UserRound size={20} />
        </span>
        <span className={styles.body}>
          <span className={styles.head}>
            <span id="teacher-profile-checklist" className={styles.title}>
              Finish your profile
            </span>
            <span className={styles.count}>
              {done}/{checks.length}
            </span>
          </span>
          <span
            className={styles.bar}
            role="progressbar"
            aria-label="Profile"
            aria-valuemin={0}
            aria-valuemax={checks.length}
            aria-valuenow={done}
          >
            <span className={styles.fill} style={{ width: `${(done / checks.length) * 100}%` }} />
          </span>
          <span className={styles.missing}>Add: {missing.join(", ")}</span>
        </span>
        <ArrowRight className={styles.arrow} size={20} aria-hidden="true" />
      </Link>
    </section>
  );
};
