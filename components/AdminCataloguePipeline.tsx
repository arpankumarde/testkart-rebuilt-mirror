import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "./Skeleton";
import type { PipelineRow } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import {
  CONTENT_KIND_LABELS,
  CONTENT_KIND_COLORS,
  CONTENT_KIND_HREFS,
  CONTENT_KIND_ICONS,
  CONTENT_DRAFT_LABELS,
} from "../helpers/adminCatalogueKinds";
import styles from "./AdminCataloguePipeline.module.css";

type Props = {
  pipeline: PipelineRow[];
  days: number;
  isLoading: boolean;
  className?: string;
};

export const AdminCataloguePipeline = ({ pipeline, days, isLoading, className }: Props) => {
  const showSkeleton = isLoading && pipeline.length === 0;
  const totalItems = pipeline.reduce((sum, row) => sum + row.total, 0);
  const totalPublished = pipeline.reduce((sum, row) => sum + row.published, 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Catalogue by type">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Catalogue</h2>
          <span className={styles.subtitle}>every type, all time</span>
        </div>
        {totalItems > 0 && (
          <span className={styles.headFigure}>
            {adminFormat.count(totalPublished)} of {adminFormat.count(totalItems)} live
          </span>
        )}
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: "3.5rem", width: "100%" }} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.columnHeader} aria-hidden="true">
            <span className={styles.colType}>Type</span>
            <span className={styles.colBar}>Published, draft, archived</span>
            <span className={styles.colNum}>New</span>
            <span className={styles.colNum}>Live</span>
            <span className={styles.colNum}>Stalled</span>
          </div>

          <ul className={styles.rows}>
            {pipeline.map((row) => {
              const Icon = CONTENT_KIND_ICONS[row.kind];
              const color = CONTENT_KIND_COLORS[row.kind];
              const draftLabel = CONTENT_DRAFT_LABELS[row.kind];
              return (
                <li key={row.kind} className={styles.row}>
                  <Link to={CONTENT_KIND_HREFS[row.kind]} className={styles.rowLink}>
                    <span className={styles.type}>
                      <span className={styles.typeIcon} style={{ backgroundColor: color }}>
                        <Icon size={14} aria-hidden="true" />
                      </span>
                      <span className={styles.typeText}>
                        <span className={styles.typeName}>
                          {CONTENT_KIND_LABELS[row.kind]}
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
                          <b>{adminFormat.count(row.published)}</b> published
                        </span>
                        <span className={styles.barFigure}>
                          <b>{adminFormat.count(row.draft)}</b> {draftLabel.toLowerCase()}
                        </span>
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

                    <span className={styles.num}>
                      <b className={row.staleDrafts > 0 ? styles.numValueWarn : styles.numValue}>
                        {adminFormat.count(row.staleDrafts)}
                      </b>
                      <span className={styles.numLabel}>30d idle</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className={styles.footnote}>
            Test series and live tests store no publish date, so only their current state is known. Stalled counts
            unpublished items nobody has edited in 30 days.
          </p>
        </>
      )}
    </section>
  );
};
