import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";
import type { StaleRow } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import {
  SURFACE_SINGULAR,
  SURFACE_COLORS,
  SURFACE_HREFS,
  articleEditorHref,
} from "../helpers/adminContentSurfaces";
import styles from "./AdminContentFreshness.module.css";

type Props = {
  stale: StaleRow[];
  now: number;
  isLoading: boolean;
  className?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Past this many days without an edit, the age reads as a warning. */
const WARN_DAYS = 90;

/** Opens the row itself where its surface has a per-item editor, else the surface's list. */
const rowHref = (row: StaleRow): string => {
  if (row.surface === "blog" || row.surface === "knowledge_base") return articleEditorHref(row.id);
  if (row.surface === "static_page" && row.slug) {
    return `/admin/static-pages?page=${encodeURIComponent(row.slug)}`;
  }
  if (row.surface === "exam_page" && row.examId !== null && row.pageType) {
    return `/admin/exam-content/${row.examId}?section=${encodeURIComponent(row.pageType)}`;
  }
  return SURFACE_HREFS[row.surface];
};

export const AdminContentFreshness = ({ stale, now, isLoading, className }: Props) => {
  const showSkeleton = isLoading && stale.length === 0;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Least recently updated">
      <div className={styles.head}>
        <h2 className={styles.title}>Oldest edits</h2>
        <span className={styles.subtitle}>live pages nobody has touched in a while</span>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: "2.25rem", width: "100%" }} />
          ))}
        </div>
      ) : stale.length === 0 ? (
        <p className={styles.empty}>Nothing is published yet.</p>
      ) : (
        <ul className={styles.rows}>
          {stale.map((row) => {
            const ageDays = Math.floor((now - row.updatedAt.getTime()) / DAY_MS);
            return (
              <li key={`${row.surface}-${row.id}`} className={styles.row}>
                <Link to={rowHref(row)} className={styles.rowLink}>
                  <span className={styles.stripe} style={{ backgroundColor: SURFACE_COLORS[row.surface] }} />
                  <span className={styles.body}>
                    <span className={styles.rowTitle} title={row.title}>
                      {row.title}
                    </span>
                    <span className={styles.rowMeta}>{SURFACE_SINGULAR[row.surface]}</span>
                  </span>
                  <span className={styles.side}>
                    <span className={ageDays >= WARN_DAYS ? styles.ageWarn : styles.age}>
                      {adminFormat.relativeTime(row.updatedAt, now)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
