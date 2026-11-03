import React from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import type { TeacherOverviewTotals } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { TEACHER_CONTENT_KINDS, type TeacherContentKind } from "../helpers/teacherContentKinds";
import { adminFormat } from "../helpers/adminFormat";
import { TeacherKindTile } from "./TeacherKindTile";
import { contentToneClass } from "./TeacherConsoleTheme";
import styles from "./TeacherOverviewShelf.module.css";

type Props = { totals: TeacherOverviewTotals };

const countsFor = (kind: TeacherContentKind, totals: TeacherOverviewTotals) => {
  switch (kind) {
    case "mock_test":
      return { live: totals.publishedTests, drafts: totals.draftTests };
    case "course":
      return { live: totals.publishedCourses, drafts: totals.draftCourses };
    case "digital_product":
      return { live: totals.publishedProducts, drafts: totals.draftProducts };
    case "bundle":
      return { live: totals.publishedBundles, drafts: totals.draftBundles };
    case "live_test":
      return { live: totals.activeLiveTests, drafts: 0 };
  }
};

/** One tile per content kind: the live count, drafts in small type; an empty kind opens its creator. */
export const TeacherOverviewShelf = ({ totals }: Props) => (
  <section className={styles.card} aria-labelledby="teacher-shelf">
    <h2 id="teacher-shelf" className={styles.title}>
      Your content
    </h2>
    <ul className={styles.grid}>
      {TEACHER_CONTENT_KINDS.map((meta) => {
        const { live, drafts } = countsFor(meta.kind, totals);
        const has = live + drafts > 0;
        const liveWord = meta.kind === "live_test" ? "scheduled" : "live";
        return (
          <li key={meta.kind}>
            <Link
              to={has ? meta.listPath : meta.createPath}
              className={`${styles.tile} ${has ? "" : styles.empty} ${contentToneClass(meta.kind)}`}
              aria-label={
                has
                  ? `${meta.plural}: ${live} ${liveWord}${drafts > 0 ? `, ${drafts} ${drafts === 1 ? "draft" : "drafts"}` : ""}`
                  : `Create ${meta.label.toLowerCase()}`
              }
            >
              <span className={styles.head}>
                <TeacherKindTile kind={meta.kind} size="sm" />
                <span className={styles.label}>{meta.plural}</span>
              </span>
              {has ? (
                <span className={styles.count}>
                  {adminFormat.count(live)}
                  {drafts > 0 && <span className={styles.drafts}>+{adminFormat.count(drafts)} {drafts === 1 ? "draft" : "drafts"}</span>}
                </span>
              ) : (
                <span className={styles.start}>
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  Create
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  </section>
);
