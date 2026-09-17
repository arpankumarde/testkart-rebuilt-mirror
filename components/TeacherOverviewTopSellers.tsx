import React from "react";
import { Skeleton } from "./Skeleton";
import type { TeacherTopSeller, TeacherMixKind } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { teacherContentThumbnail } from "../helpers/teacherContentThumbnail";
import styles from "./TeacherOverviewTopSellers.module.css";

type Props = {
  sellers: TeacherTopSeller[];
  days: number;
  isLoading: boolean;
  /** False for team managers, who do not see the owner's money. */
  showEarnings?: boolean;
  className?: string;
};

const KIND_LABELS: Record<TeacherMixKind, string> = {
  mock_test: "Test series",
  live_test: "Live test",
  course: "Course",
  digital_product: "Study notes",
  bundle: "Bundle",
};

const Thumbnail = ({ seller }: { seller: TeacherTopSeller }) => {
  const thumbnail = teacherContentThumbnail(seller.kind, seller.thumbnail);
  if (thumbnail.type === "image") {
    return <img src={thumbnail.src} alt="" className={styles.thumbImage} loading="lazy" />;
  }
  const Icon = thumbnail.icon;
  return (
    <span className={styles.thumbIcon}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
};

export const TeacherOverviewTopSellers = ({ sellers, days, isLoading, showEarnings = true, className }: Props) => {
  const showSkeleton = isLoading && sellers.length === 0;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Best sellers">
      <div className={styles.head}>
        <h2 className={styles.title}>Best sellers</h2>
        <span className={styles.subtitle}>last {days} days</span>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} style={{ height: "2.75rem", width: "100%" }} />
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <p className={styles.empty}>No sales in this period.</p>
      ) : (
        <ol className={styles.rows}>
          {sellers.map((seller) => (
            <li key={`${seller.kind}-${seller.title}`} className={styles.row}>
              <span className={styles.thumb}>
                <Thumbnail seller={seller} />
              </span>
              <span className={styles.body}>
                <span className={styles.rowTitle} title={seller.title}>
                  {seller.title}
                </span>
                <span className={styles.rowMeta}>
                  {KIND_LABELS[seller.kind]} · {adminFormat.count(seller.units)}{" "}
                  {seller.units === 1 ? "sale" : "sales"}
                </span>
              </span>
              {showEarnings && <span className={styles.earnings}>{adminFormat.inr(seller.earnings)}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
