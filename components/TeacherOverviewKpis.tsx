import React from "react";
import { Skeleton } from "./Skeleton";
import type {
  TeacherOverviewKpis as Kpis,
  TeacherDailyPoint,
} from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./TeacherOverviewKpis.module.css";

type Props = {
  kpis: Kpis | undefined;
  daily: TeacherDailyPoint[];
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
};

export const TeacherOverviewKpis = ({ kpis, daily, isLoading, className }: Props) => {
  const showSkeleton = isLoading && !kpis;

  const columns: Column[] = kpis
    ? [
        {
          label: "Earnings",
          value: adminFormat.inr(kpis.earnings.current),
          delta: adminFormat.delta(kpis.earnings.current, kpis.earnings.previous),
          values: daily.map((point) => point.earnings),
        },
        {
          label: "Sales",
          value: adminFormat.count(kpis.sales.current),
          delta: adminFormat.delta(kpis.sales.current, kpis.sales.previous),
          values: daily.map((point) => point.sales),
        },
        {
          label: "New enrolments",
          value: adminFormat.count(kpis.enrollments.current),
          delta: adminFormat.delta(kpis.enrollments.current, kpis.enrollments.previous),
          values: daily.map((point) => point.enrollments),
        },
        {
          label: "Test attempts",
          value: adminFormat.count(kpis.attempts.current),
          delta: adminFormat.delta(kpis.attempts.current, kpis.attempts.previous),
          values: daily.map((point) => point.attempts),
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
              </div>
            ))}
      </div>
    </section>
  );
};
