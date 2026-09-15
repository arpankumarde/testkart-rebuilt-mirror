import React, { useState } from "react";
import { Skeleton } from "./Skeleton";
import type { TopSeller, TopTeacher } from "../endpoints/admin/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { MIX_LABELS } from "./AdminRevenueMix";
import styles from "./AdminTopSellers.module.css";

type Props = {
  sellers: TopSeller[];
  teachers: TopTeacher[];
  days: number;
  isLoading: boolean;
  className?: string;
};

type View = "items" | "teachers";

export const AdminTopSellers = ({ sellers, teachers, days, isLoading, className }: Props) => {
  const [view, setView] = useState<View>("items");
  const showSkeleton = isLoading && sellers.length === 0 && teachers.length === 0;

  const rows =
    view === "items"
      ? sellers.map((seller) => ({
          key: `${seller.kind}-${seller.title}`,
          title: seller.title,
          meta: seller.teacherName ? `${MIX_LABELS[seller.kind]}, ${seller.teacherName}` : MIX_LABELS[seller.kind],
          units: seller.units,
          revenue: seller.revenue,
        }))
      : teachers.map((teacher) => ({
          key: `${teacher.teacherId ?? "unknown"}-${teacher.name}`,
          title: teacher.name,
          meta: `${adminFormat.count(teacher.units)} ${teacher.units === 1 ? "sale" : "sales"}`,
          units: teacher.units,
          revenue: teacher.revenue,
        }));
  const maxRevenue = rows.reduce((max, row) => Math.max(max, row.revenue), 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Top sellers">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Top sellers</h2>
          <span className={styles.subtitle}>last {days} days</span>
        </div>
        <div className={styles.switch} role="tablist" aria-label="Rank by">
          <button
            type="button"
            role="tab"
            aria-selected={view === "items"}
            className={`${styles.switchButton} ${view === "items" ? styles.switchActive : ""}`}
            onClick={() => setView("items")}
          >
            Items
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "teachers"}
            className={`${styles.switchButton} ${view === "teachers" ? styles.switchActive : ""}`}
            onClick={() => setView("teachers")}
          >
            Teachers
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
        <p className={styles.empty}>No completed sales in this period.</p>
      ) : (
        <ol className={styles.rows}>
          {rows.map((row, index) => (
            <li key={row.key} className={styles.row}>
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.body}>
                <span className={styles.rowTitle} title={row.title}>
                  {row.title}
                </span>
                <span className={styles.rowMeta}>{row.meta}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ width: `${maxRevenue > 0 ? Math.max(2, (row.revenue / maxRevenue) * 100) : 0}%` }}
                  />
                </span>
              </span>
              <span className={styles.figures}>
                <span className={styles.revenue}>{adminFormat.inr(row.revenue)}</span>
                {view === "items" && (
                  <span className={styles.units}>
                    {adminFormat.count(row.units)} {row.units === 1 ? "sale" : "sales"}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
