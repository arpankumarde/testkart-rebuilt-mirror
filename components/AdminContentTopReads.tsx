import React from "react";
import { Link } from "react-router-dom";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Skeleton } from "./Skeleton";
import type { TopReadRow } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { SURFACE_SINGULAR, SURFACE_COLORS, articleEditorHref } from "../helpers/adminContentSurfaces";
import styles from "./AdminContentTopReads.module.css";

type Props = {
  topReads: TopReadRow[];
  isLoading: boolean;
  className?: string;
};

export const AdminContentTopReads = ({ topReads, isLoading, className }: Props) => {
  const showSkeleton = isLoading && topReads.length === 0;
  const max = topReads.reduce((peak, row) => Math.max(peak, row.views), 0);
  const totalViews = topReads.reduce((sum, row) => sum + row.views, 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Most read">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Most read</h2>
          <span className={styles.subtitle}>all time</span>
        </div>
        {totalViews > 0 && <span className={styles.headFigure}>{adminFormat.count(totalViews)} views</span>}
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: "2.25rem", width: "100%" }} />
          ))}
        </div>
      ) : topReads.length === 0 ? (
        <p className={styles.empty}>Nothing is published yet.</p>
      ) : (
        <ol className={styles.rows}>
          {topReads.map((row, index) => (
            <li key={`${row.surface}-${row.id}`} className={styles.row}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.body}>
                <Link to={articleEditorHref(row.id)} className={styles.rowTitle} title={row.title}>
                  <span className={styles.tag} style={{ backgroundColor: SURFACE_COLORS[row.surface] }}>
                    {SURFACE_SINGULAR[row.surface]}
                  </span>
                  {row.title}
                </Link>
                <span className={styles.rowMeta}>
                  {row.author ?? "No author"}
                  {(row.likes > 0 || row.dislikes > 0) && (
                    <>
                      <span className={styles.reaction}>
                        <ThumbsUp size={11} aria-hidden="true" />
                        {adminFormat.count(row.likes)}
                      </span>
                      {row.dislikes > 0 && (
                        <span className={`${styles.reaction} ${styles.reactionDown}`}>
                          <ThumbsDown size={11} aria-hidden="true" />
                          {adminFormat.count(row.dislikes)}
                        </span>
                      )}
                    </>
                  )}
                </span>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ width: `${max > 0 ? Math.max(2, (row.views / max) * 100) : 0}%` }}
                  />
                </span>
              </span>
              <span className={styles.figures}>
                <span className={styles.value}>{adminFormat.count(row.views)}</span>
                <span className={styles.valueLabel}>views</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
