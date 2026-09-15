import React from "react";
import { Skeleton } from "./Skeleton";
import type { SiteContentKpis, SiteDailyPoint } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminContentKpis.module.css";

type Props = {
  kpis: SiteContentKpis | undefined;
  daily: SiteDailyPoint[];
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

export const AdminContentKpis = ({ kpis, daily, days, isLoading, className }: Props) => {
  const showSkeleton = isLoading && !kpis;

  const blog = daily.reduce((sum, point) => sum + point.blog, 0);
  const kb = daily.reduce((sum, point) => sum + point.knowledgeBase, 0);

  const columns: Column[] = kpis
    ? [
        {
          label: "Articles published",
          value: adminFormat.count(kpis.published.current),
          delta: adminFormat.delta(kpis.published.current, kpis.published.previous),
          values: daily.map((d) => d.blog + d.knowledgeBase),
          note: `${adminFormat.count(blog)} blog, ${adminFormat.count(kb)} help pages`,
        },
        {
          label: "Exam pages published",
          value: adminFormat.count(kpis.examPagesPublished.current),
          delta: adminFormat.delta(kpis.examPagesPublished.current, kpis.examPagesPublished.previous),
          values: daily.map((d) => d.examPage),
          note: `${adminFormat.count(kpis.created.current)} articles drafted in the same window`,
        },
        {
          label: "Reader reactions",
          value: adminFormat.count(kpis.reactions.current),
          delta: adminFormat.delta(kpis.reactions.current, kpis.reactions.previous),
          values: [],
          note: `${adminFormat.count(kpis.comments.current)} ${kpis.comments.current === 1 ? "comment" : "comments"} left`,
        },
        {
          label: "Job applications",
          value: adminFormat.count(kpis.applications.current),
          delta: adminFormat.delta(kpis.applications.current, kpis.applications.previous),
          values: [],
          note: "through the careers page",
        },
      ]
    : [];

  return (
    <section className={`${styles.ledger} ${className ?? ""}`.trim()} aria-label="Content key figures">
      <div className={styles.columns}>
        {showSkeleton
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.column} aria-hidden="true">
                <Skeleton style={{ height: "0.875rem", width: "6rem" }} />
                <Skeleton style={{ height: "2rem", width: "5rem", marginTop: "var(--spacing-2)" }} />
                <Skeleton style={{ height: "2rem", width: "100%", marginTop: "var(--spacing-3)" }} />
              </div>
            ))
          : columns.map((column) => (
              <div key={column.label} className={styles.column}>
                <span className={styles.label}>{column.label}</span>
                <span className={styles.value}>{column.value}</span>
                <span className={`${styles.delta} ${styles[column.delta.tone]}`}>{column.delta.text}</span>
                {column.values.length > 1 ? <Sparkline values={column.values} /> : <span className={styles.noSpark} />}
                <span className={styles.note}>{column.note}</span>
              </div>
            ))}
      </div>
      <p className={styles.caption}>
        {days === 1
          ? "Today, change measured against yesterday"
          : `Last ${days} days, change measured against the ${days} days before`}
      </p>
    </section>
  );
};
