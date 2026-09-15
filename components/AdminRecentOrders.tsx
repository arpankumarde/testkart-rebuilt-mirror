import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";
import type { RecentOrder } from "../endpoints/admin/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminRecentOrders.module.css";

type Props = {
  orders: RecentOrder[];
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

export const AdminRecentOrders = ({ orders, isLoading, className }: Props) => {
  const showSkeleton = isLoading && orders.length === 0;
  const now = Date.now();

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Recent orders">
      <div className={styles.head}>
        <h2 className={styles.title}>Recent orders</h2>
        <Link to="/admin/transactions" className={styles.link}>
          All transactions
        </Link>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>No orders yet.</p>
      ) : (
        <ul className={styles.rows}>
          {orders.map((order) => (
            <li key={order.id} className={styles.row}>
              <span
                className={`${styles.dot} ${styles[STATUS_CLASS[order.status] ?? "pending"]}`}
                title={order.status}
              />
              <span className={styles.body}>
                <span className={styles.line}>
                  <span className={styles.student}>{order.studentName}</span>
                  <span className={styles.orderId}>#{order.id}</span>
                </span>
                <span className={styles.summary} title={order.summary}>
                  {order.summary}
                </span>
              </span>
              <span className={styles.figures}>
                <span className={styles.amount}>{order.amount > 0 ? adminFormat.inr(order.amount) : "Free"}</span>
                <span className={styles.time}>{adminFormat.relativeTime(order.createdAt, now)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
