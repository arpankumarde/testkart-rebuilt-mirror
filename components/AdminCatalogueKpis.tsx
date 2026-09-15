import React from "react";
import { Skeleton } from "./Skeleton";
import type { ContentKpis, ContentDailyPoint } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminCatalogueKpis.module.css";

type Props = {
  kpis: ContentKpis | undefined;
  daily: ContentDailyPoint[];
  days: number;
  isLoading: boolean;
  className?: string;
};

const WIDTH = 100;
const HEIGHT = 32;
const PAD = 3;

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

export const AdminCatalogueKpis = ({ kpis, daily, days, isLoading, className }: Props) => {
  const showSkeleton = isLoading && !kpis;

  const sum = (pick: (point: ContentDailyPoint) => number) => daily.reduce((total, point) => total + pick(point), 0);
  const tests = sum((d) => d.mockTest);
  const courses = sum((d) => d.course);
  const notes = sum((d) => d.digitalProduct);

  const columns: Column[] = kpis
    ? [
        {
          label: "New content",
          value: adminFormat.count(kpis.created.current),
          delta: adminFormat.delta(kpis.created.current, kpis.created.previous),
          values: daily.map((d) => d.mockTest + d.course + d.digitalProduct + d.liveTest + d.courseBundle),
          note: `${adminFormat.count(tests)} series, ${adminFormat.count(courses)} courses, ${adminFormat.count(notes)} notes`,
        },
        {
          label: "Published",
          value: adminFormat.count(kpis.published.current),
          delta: adminFormat.delta(kpis.published.current, kpis.published.previous),
          values: daily.map((d) => d.published),
          note: "courses, notes and bundles record a publish date",
        },
        {
          label: "Questions added",
          value: adminFormat.count(kpis.questions.current),
          delta: adminFormat.delta(kpis.questions.current, kpis.questions.previous),
          values: daily.map((d) => d.questions),
          note: `${adminFormat.count(kpis.bankQuestions.current)} added to the question bank`,
        },
        {
          label: "Test attempts",
          value: adminFormat.count(kpis.attempts.current),
          delta: adminFormat.delta(kpis.attempts.current, kpis.attempts.previous),
          values: daily.map((d) => d.attempts),
          note: `${adminFormat.count(kpis.enrollments.current)} new enrolments`,
        },
      ]
    : [];

  return (
    <section className={`${styles.ledger} ${className ?? ""}`.trim()} aria-label="Content key figures">
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
