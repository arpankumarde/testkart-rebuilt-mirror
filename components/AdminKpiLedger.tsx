import React from "react";
import { Skeleton } from "./Skeleton";
import type { OverviewKpis, DailyPoint } from "../endpoints/admin/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminKpiLedger.module.css";

type Props = {
  kpis: OverviewKpis | undefined;
  daily: DailyPoint[];
  days: number;
  isLoading: boolean;
  className?: string;
};

const WIDTH = 100;
const HEIGHT = 32;
const PAD = 3;

/**
 * A quiet line with a coral dot on the latest day. The viewBox stretches to
 * the column width; non-scaling strokes keep the line and the dot crisp.
 */
const Sparkline = ({ values }: { values: number[] }) => {
  if (values.length === 0) return <div className={styles.spark} />;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = PAD + index * step;
    const y = HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))] as const;
  });
  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg className={styles.spark} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} className={styles.sparkLine} vectorEffect="non-scaling-stroke" />
      <path d={`M${lastX} ${lastY} h0.01`} className={styles.sparkDot} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

type Column = {
  label: string;
  value: string;
  delta: ReturnType<typeof adminFormat.delta>;
  values: number[];
  note: string;
};

export const AdminKpiLedger = ({ kpis, daily, days, isLoading, className }: Props) => {
  const showSkeleton = isLoading && !kpis;

  const columns: Column[] = kpis
    ? [
        {
          label: "Revenue",
          value: adminFormat.inr(kpis.revenue.current),
          delta: adminFormat.delta(kpis.revenue.current, kpis.revenue.previous),
          values: daily.map((d) => d.revenue),
          note:
            kpis.subscriptionRevenue.current > 0
              ? `${adminFormat.inr(kpis.subscriptionRevenue.current)} from subscriptions`
              : `${adminFormat.count(kpis.paidOrders.current)} paid orders`,
        },
        {
          label: "Orders",
          value: adminFormat.count(kpis.orders.current),
          delta: adminFormat.delta(kpis.orders.current, kpis.orders.previous),
          values: daily.map((d) => d.orders),
          note: `${adminFormat.count(kpis.paidOrders.current)} paid, ${adminFormat.count(kpis.failedOrders.current)} failed`,
        },
        {
          label: "New users",
          value: adminFormat.count(kpis.newTeachers.current + kpis.newStudents.current),
          delta: adminFormat.delta(
            kpis.newTeachers.current + kpis.newStudents.current,
            kpis.newTeachers.previous + kpis.newStudents.previous
          ),
          values: daily.map((d) => d.teachers + d.students),
          note: `${adminFormat.count(kpis.newTeachers.current)} teachers, ${adminFormat.count(kpis.newStudents.current)} students`,
        },
        {
          label: "Test attempts",
          value: adminFormat.count(kpis.attempts.current),
          delta: adminFormat.delta(kpis.attempts.current, kpis.attempts.previous),
          values: daily.map((d) => d.attempts),
          note: `${adminFormat.count(kpis.testsPublished.current)} tests published`,
        },
      ]
    : [];

  return (
    <section className={`${styles.ledger} ${className ?? ""}`.trim()} aria-label="Key figures">
      <div className={styles.columns}>
        {showSkeleton
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.column} aria-hidden="true">
                <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
                <Skeleton style={{ height: "2rem", width: "7rem", marginTop: "var(--spacing-2)" }} />
                <Skeleton style={{ height: "2rem", width: "100%", marginTop: "var(--spacing-3)" }} />
              </div>
            ))
          : columns.map((column) => (
              <div key={column.label} className={styles.column}>
                <span className={styles.label}>{column.label}</span>
                <span className={styles.value}>{column.value}</span>
                <span className={`${styles.delta} ${styles[column.delta.tone]}`}>{column.delta.text}</span>
                <Sparkline values={column.values} />
                <span className={styles.note}>{column.note}</span>
              </div>
            ))}
      </div>
      <p className={styles.caption}>
        Last {days} days, change measured against the {days} days before
      </p>
    </section>
  );
};
