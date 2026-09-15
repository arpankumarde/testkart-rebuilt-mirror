import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";
import type { RecentContentRow } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { CONTENT_KIND_SINGULAR, CONTENT_KIND_COLORS, contentItemHref } from "../helpers/adminCatalogueKinds";
import styles from "./AdminCatalogueRecent.module.css";

type Props = {
  recent: RecentContentRow[];
  now: number;
  isLoading: boolean;
  className?: string;
};

const STATUS_LABELS: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

export const AdminCatalogueRecent = ({ recent, now, isLoading, className }: Props) => {
  const showSkeleton = isLoading && recent.length === 0;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Recently added content">
      <div className={styles.head}>
        <h2 className={styles.title}>Just added</h2>
        <span className={styles.subtitle}>newest across every type</span>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: "2.5rem", width: "100%" }} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className={styles.empty}>No content has been created yet.</p>
      ) : (
        <ul className={styles.rows}>
          {recent.map((item) => (
            <li key={`${item.kind}-${item.id}`} className={styles.row}>
              <Link to={contentItemHref(item.kind, item.id)} className={styles.rowLink}>
                <span className={styles.stripe} style={{ backgroundColor: CONTENT_KIND_COLORS[item.kind] }} />
                <span className={styles.body}>
                  <span className={styles.rowTitle} title={item.title}>
                    {item.title}
                  </span>
                  <span className={styles.rowMeta}>
                    {CONTENT_KIND_SINGULAR[item.kind]}
                    {item.teacherName ? ` by ${item.teacherName}` : ""}
                  </span>
                </span>
                <span className={styles.side}>
                  <span className={`${styles.status} ${styles[item.status] ?? ""}`.trim()}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <span className={styles.time}>{adminFormat.relativeTime(item.createdAt, now)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
