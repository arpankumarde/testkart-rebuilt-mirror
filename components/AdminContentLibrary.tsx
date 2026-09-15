import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "./Skeleton";
import type { SurfaceRow } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import {
  SURFACE_LABELS,
  SURFACE_COLORS,
  SURFACE_HREFS,
  SURFACE_ICONS,
  SURFACE_DRAFT_LABELS,
  SURFACE_PUBLISH_LABELS,
} from "../helpers/adminContentSurfaces";
import styles from "./AdminContentLibrary.module.css";

type Props = {
  surfaces: SurfaceRow[];
  days: number;
  isLoading: boolean;
  className?: string;
};

export const AdminContentLibrary = ({ surfaces, days, isLoading, className }: Props) => {
  const showSkeleton = isLoading && surfaces.length === 0;
  const total = surfaces.reduce((sum, row) => sum + row.total, 0);
  const live = surfaces.reduce((sum, row) => sum + row.published, 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Content library">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Library</h2>
          <span className={styles.subtitle}>everything the team writes</span>
        </div>
        {total > 0 && (
          <span className={styles.headFigure}>
            {adminFormat.count(live)} of {adminFormat.count(total)} live
          </span>
        )}
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} style={{ height: "3.25rem", width: "100%" }} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.columnHeader} aria-hidden="true">
            <span>Surface</span>
            <span>Live vs unpublished</span>
            <span className={styles.colNum}>New</span>
            <span className={styles.colNum}>Published</span>
          </div>

          <ul className={styles.rows}>
            {surfaces.map((row) => {
              const Icon = SURFACE_ICONS[row.surface];
              const color = SURFACE_COLORS[row.surface];
              const unpublished = row.draft + row.archived;
              return (
                <li key={row.surface} className={styles.row}>
                  <Link to={SURFACE_HREFS[row.surface]} className={styles.rowLink}>
                    <span className={styles.type}>
                      <span className={styles.typeIcon} style={{ backgroundColor: color }}>
                        <Icon size={14} aria-hidden="true" />
                      </span>
                      <span className={styles.typeText}>
                        <span className={styles.typeName}>
                          {SURFACE_LABELS[row.surface]}
                          <ArrowUpRight size={13} className={styles.typeArrow} aria-hidden="true" />
                        </span>
                        <span className={styles.typeTotal}>{adminFormat.count(row.total)} total</span>
                      </span>
                    </span>

                    <span className={styles.barGroup}>
                      <span className={styles.bar} aria-hidden="true">
                        {row.published > 0 && (
                          <span
                            className={styles.segment}
                            style={{ flexGrow: row.published, backgroundColor: color }}
                          />
                        )}
                        {row.draft > 0 && (
                          <span className={`${styles.segment} ${styles.segmentDraft}`} style={{ flexGrow: row.draft }} />
                        )}
                        {row.archived > 0 && (
                          <span
                            className={`${styles.segment} ${styles.segmentArchived}`}
                            style={{ flexGrow: row.archived }}
                          />
                        )}
                      </span>
                      <span className={styles.barLegend}>
                        <span className={styles.barFigure}>
                          <b>{adminFormat.count(row.published)}</b> {SURFACE_PUBLISH_LABELS[row.surface]}
                        </span>
                        {unpublished > 0 && (
                          <span className={styles.barFigure}>
                            <b>{adminFormat.count(row.draft)}</b> {SURFACE_DRAFT_LABELS[row.surface]}
                          </span>
                        )}
                        {row.archived > 0 && (
                          <span className={styles.barFigure}>
                            <b>{adminFormat.count(row.archived)}</b> archived
                          </span>
                        )}
                      </span>
                    </span>

                    <span className={styles.num}>
                      <b className={styles.numValue}>{adminFormat.count(row.createdInRange)}</b>
                      <span className={styles.numLabel}>in {days}d</span>
                    </span>

                    <span className={styles.num}>
                      {row.publishedInRange === null ? (
                        <>
                          <b className={styles.numValueMuted}>n/a</b>
                          <span className={styles.numLabel}>no date</span>
                        </>
                      ) : (
                        <>
                          <b className={styles.numValue}>{adminFormat.count(row.publishedInRange)}</b>
                          <span className={styles.numLabel}>in {days}d</span>
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className={styles.footnote}>
            Static pages, careers and email templates record only a last-edited date, so they have no publish count.
          </p>
        </>
      )}
    </section>
  );
};
