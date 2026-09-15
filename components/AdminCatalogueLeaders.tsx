import React, { useState } from "react";
import { Skeleton } from "./Skeleton";
import type { TopContentRow, TopCreatorRow } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import {
  CONTENT_KIND_SINGULAR,
  CONTENT_KIND_COLORS,
  CONTENT_ENGAGEMENT_LABELS,
} from "../helpers/adminCatalogueKinds";
import styles from "./AdminCatalogueLeaders.module.css";

type Props = {
  topContent: TopContentRow[];
  topCreators: TopCreatorRow[];
  days: number;
  isLoading: boolean;
  className?: string;
};

type View = "content" | "creators";

export const AdminCatalogueLeaders = ({ topContent, topCreators, days, isLoading, className }: Props) => {
  const [view, setView] = useState<View>("content");
  const showSkeleton = isLoading && topContent.length === 0 && topCreators.length === 0;

  const rows =
    view === "content"
      ? topContent.map((item) => {
          const [one, many] = CONTENT_ENGAGEMENT_LABELS[item.kind];
          return {
            key: `${item.kind}-${item.id}`,
            title: item.title,
            meta: item.teacherName ?? CONTENT_KIND_SINGULAR[item.kind],
            tag: CONTENT_KIND_SINGULAR[item.kind],
            tagColor: CONTENT_KIND_COLORS[item.kind],
            value: item.engagement,
            valueLabel: item.engagement === 1 ? one : many,
          };
        })
      : topCreators.map((creator) => ({
          key: `${creator.teacherId ?? "unknown"}-${creator.name}`,
          title: creator.name,
          meta:
            creator.questions > 0
              ? `${adminFormat.count(creator.published)} published, ${adminFormat.count(creator.questions)} questions`
              : `${adminFormat.count(creator.published)} published`,
          tag: null,
          tagColor: null,
          value: creator.created,
          valueLabel: creator.created === 1 ? "item" : "items",
        }));

  const max = rows.reduce((peak, row) => Math.max(peak, row.value), 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Content leaders">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>{view === "content" ? "Most used" : "Most productive"}</h2>
          <span className={styles.subtitle}>last {days} days</span>
        </div>
        <div className={styles.switch} role="tablist" aria-label="Rank by">
          <button
            type="button"
            role="tab"
            aria-selected={view === "content"}
            className={`${styles.switchButton} ${view === "content" ? styles.switchActive : ""}`}
            onClick={() => setView("content")}
          >
            Content
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "creators"}
            className={`${styles.switchButton} ${view === "creators" ? styles.switchActive : ""}`}
            onClick={() => setView("creators")}
          >
            Creators
          </button>
        </div>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: "2.25rem", width: "100%" }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          {view === "content" ? "Nothing was attempted or bought in this period." : "No content was created in this period."}
        </p>
      ) : (
        <ol className={styles.rows}>
          {rows.map((row, index) => (
            <li key={row.key} className={styles.row}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.body}>
                <span className={styles.rowTitle} title={row.title}>
                  {row.tag && (
                    <span className={styles.tag} style={{ backgroundColor: row.tagColor ?? undefined }}>
                      {row.tag}
                    </span>
                  )}
                  {row.title}
                </span>
                <span className={styles.rowMeta}>{row.meta}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ width: `${max > 0 ? Math.max(2, (row.value / max) * 100) : 0}%` }}
                  />
                </span>
              </span>
              <span className={styles.figures}>
                <span className={styles.value}>{adminFormat.count(row.value)}</span>
                <span className={styles.valueLabel}>{row.valueLabel}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
