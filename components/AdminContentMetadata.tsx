import React, { useState } from "react";
import { Skeleton } from "./Skeleton";
import type { MetadataCheck } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminContentMetadata.module.css";

type Props = {
  metadata: MetadataCheck[];
  isLoading: boolean;
  className?: string;
};

type Scope = "articles" | "exam_pages";

const SCOPE_LABELS: Record<Scope, string> = {
  articles: "Articles",
  exam_pages: "Exam pages",
};

/** Under this share of items filled in, the row reads as a problem rather than a nit. */
const WEAK_SHARE = 60;

export const AdminContentMetadata = ({ metadata, isLoading, className }: Props) => {
  const [scope, setScope] = useState<Scope>("articles");
  const showSkeleton = isLoading && metadata.length === 0;
  const rows = metadata.filter((check) => check.scope === scope);
  const total = rows[0]?.total ?? 0;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Metadata completeness">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Metadata</h2>
          <span className={styles.subtitle}>{total > 0 ? `${adminFormat.count(total)} items` : "completeness"}</span>
        </div>
        <div className={styles.switch} role="tablist" aria-label="Scope">
          {(Object.keys(SCOPE_LABELS) as Scope[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              className={`${styles.switchButton} ${scope === value ? styles.switchActive : ""}`}
              onClick={() => setScope(value)}
            >
              {SCOPE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
          ))}
        </div>
      ) : rows.length === 0 || total === 0 ? (
        <p className={styles.empty}>Nothing published on this surface yet.</p>
      ) : (
        <ul className={styles.rows}>
          {rows.map((check) => {
            const share = adminFormat.share(check.complete, check.total);
            const missing = check.total - check.complete;
            return (
              <li key={check.key} className={styles.row}>
                <span className={styles.name}>{check.label}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={`${styles.barFill} ${share < WEAK_SHARE ? styles.barWeak : ""}`}
                    style={{ width: `${Math.max(share, share > 0 ? 2 : 0)}%` }}
                  />
                </span>
                <span className={styles.share}>{share}%</span>
                <span className={missing > 0 ? styles.missing : styles.missingNone}>
                  {missing > 0 ? `${adminFormat.count(missing)} missing` : "complete"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
