import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";
import type { TeacherRecentSale } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { teacherContentThumbnail } from "../helpers/teacherContentThumbnail";
import styles from "./TeacherOverviewRecentSales.module.css";

type Props = {
  sales: TeacherRecentSale[];
  isLoading: boolean;
  className?: string;
};

const STATUS_CLASS: Record<string, string> = {
  completed: "completed",
  pending: "pending",
  failed: "failed",
  cancelled: "failed",
  refunded: "refunded",
};

const Thumbnail = ({ sale }: { sale: TeacherRecentSale }) => {
  const thumbnail = teacherContentThumbnail(sale.kind, sale.thumbnail);
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

export const TeacherOverviewRecentSales = ({ sales, isLoading, className }: Props) => {
  const showSkeleton = isLoading && sales.length === 0;
  const now = Date.now();

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Recent sales">
      <div className={styles.head}>
        <h2 className={styles.title}>Recent sales</h2>
        <Link to="/teacher/reports" className={styles.link}>
          All earnings
        </Link>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} style={{ height: "2.75rem", width: "100%" }} />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <p className={styles.empty}>No sales yet.</p>
      ) : (
        <ul className={styles.rows}>
          {sales.map((sale) => {
            const statusClass = STATUS_CLASS[sale.status] ?? "pending";
            return (
              <li key={sale.orderId} className={styles.row}>
                <span className={styles.thumb}>
                  <Thumbnail sale={sale} />
                  {sale.status !== "completed" && (
                    <span className={`${styles.dot} ${styles[statusClass]}`} title={sale.status} />
                  )}
                </span>
                <span className={styles.body}>
                  <span className={styles.summary} title={sale.summary}>
                    {sale.summary}
                  </span>
                  <span className={styles.student}>{sale.studentName}</span>
                </span>
                <span className={styles.figures}>
                  <span className={styles.amount}>
                    {sale.amount > 0 ? adminFormat.inr(sale.amount) : "Free"}
                  </span>
                  <span className={styles.time}>{adminFormat.relativeTime(sale.createdAt, now)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
