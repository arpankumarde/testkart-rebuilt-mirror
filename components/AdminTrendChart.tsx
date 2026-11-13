import React, { useEffect, useState } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "./Skeleton";
import { SegmentedControl } from "./SegmentedControl";
import type { TrendBucket } from "../endpoints/admin/dashboard/trends_GET.schema";
import { useAdminDashboardTrends } from "../helpers/useAdminDashboardTrends";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminTrendChart.module.css";

type Grain = "monthly" | "weekly";
type Metric = "revenue" | "students";

const GRAIN_KEY = "admin_trend_grain";
const METRIC_KEY = "admin_trend_metric";

const GRAIN_OPTIONS = [
  { value: "monthly" as const, label: "Months" },
  { value: "weekly" as const, label: "Weeks" },
];
const METRIC_OPTIONS = [
  { value: "revenue" as const, label: "Revenue" },
  { value: "students" as const, label: "Students" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const parts = (start: string) => {
  const [y, m, d] = start.split("-").map(Number);
  return { y, m: m - 1, d };
};

const shortLabel = (start: string, grain: Grain, index: number) => {
  const { y, m, d } = parts(start);
  if (grain === "weekly") return `${d} ${MONTHS[m]}`;
  return index === 0 || m === 0 ? `${MONTHS[m]} '${String(y).slice(2)}` : MONTHS[m];
};

const longLabel = (start: string, grain: Grain) => {
  const { y, m, d } = parts(start);
  if (grain === "monthly") return `${MONTHS_LONG[m]} ${y}`;
  const end = new Date(Date.UTC(y, m, d + 6));
  return `Week of ${d} ${MONTHS[m]} - ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]}`;
};

const readStored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && (allowed as readonly string[]).includes(stored)) return stored as T;
  } catch {
    // Storage unavailable: fall back to the default.
  }
  return fallback;
};

const store = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference simply resets next visit.
  }
};

type Point = TrendBucket & { label: string; title: string; value: number; previous: number | null; current: boolean };

type TipProps = { active?: boolean; payload?: Array<{ payload: Point }>; metric: Metric; grain: Grain };

const ChartTip = ({ active, payload, metric, grain }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const delta = point.previous ? adminFormat.delta(point.value, point.previous) : null;
  return (
    <div className={styles.tip}>
      <span className={styles.tipTitle}>
        {point.title}
        {point.current && <span className={styles.tipNote}> (so far)</span>}
      </span>
      <span className={styles.tipValue}>
        {metric === "revenue" ? adminFormat.inr(point.revenue) : `${adminFormat.count(point.students)} new students`}
      </span>
      <span className={styles.tipMeta}>
        {metric === "revenue"
          ? `${adminFormat.count(point.orders)} ${point.orders === 1 ? "order" : "orders"}`
          : `${adminFormat.count(point.teachers)} new teachers`}
      </span>
      {delta && (
        <span className={`${styles.tipDelta} ${styles[delta.tone]}`}>
          {delta.text} vs previous {grain === "monthly" ? "month" : "week"}
        </span>
      )}
    </div>
  );
};

type Props = { enabled: boolean; className?: string };

/** Month by month or week by week bars for revenue or new students; the last bar is the current period. */
export const AdminTrendChart = ({ enabled, className }: Props) => {
  const [grain, setGrain] = useState<Grain>("monthly");
  const [metric, setMetric] = useState<Metric>("revenue");

  useEffect(() => {
    setGrain(readStored(GRAIN_KEY, ["monthly", "weekly"] as const, "monthly"));
    setMetric(readStored(METRIC_KEY, ["revenue", "students"] as const, "revenue"));
  }, []);

  const { data, isPending, isError, error } = useAdminDashboardTrends(grain, enabled);
  const buckets = data?.period === grain ? data.buckets : (data?.buckets ?? []);

  const points: Point[] = buckets.map((bucket, index) => {
    const value = metric === "revenue" ? bucket.revenue : bucket.students;
    const before = index > 0 ? buckets[index - 1] : null;
    return {
      ...bucket,
      label: shortLabel(bucket.start, grain, index),
      title: longLabel(bucket.start, grain),
      value,
      previous: before ? (metric === "revenue" ? before.revenue : before.students) : null,
      current: index === buckets.length - 1,
    };
  });

  const changeGrain = (value: Grain) => {
    setGrain(value);
    store(GRAIN_KEY, value);
  };
  const changeMetric = (value: Metric) => {
    setMetric(value);
    store(METRIC_KEY, value);
  };

  const unit = grain === "monthly" ? "month" : "week";
  const subtitle = grain === "monthly" ? "by month, last 12 months" : "by week, last 12 weeks";
  const latest = points[points.length - 1];

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label={`${metric === "revenue" ? "Revenue" : "New students"} ${subtitle}`}>
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>{metric === "revenue" ? "Revenue" : "New students"}</h2>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        <div className={styles.controls}>
          <SegmentedControl value={metric} onValueChange={changeMetric} options={METRIC_OPTIONS} aria-label="Measure" />
          <SegmentedControl value={grain} onValueChange={changeGrain} options={GRAIN_OPTIONS} aria-label="Group by" />
        </div>
      </div>

      {latest && (
        <p className={styles.summary}>
          <span className={styles.summaryValue}>
            {metric === "revenue" ? adminFormat.inr(latest.revenue) : adminFormat.count(latest.students)}
          </span>{" "}
          this {unit} so far
          {latest.previous !== null && (
            <>
              , against {metric === "revenue" ? adminFormat.inr(latest.previous) : adminFormat.count(latest.previous)} last {unit}
            </>
          )}
        </p>
      )}

      {isError ? (
        <p className={styles.error} role="alert">
          The chart could not be loaded. {error instanceof Error ? error.message : ""}
        </p>
      ) : isPending && points.length === 0 ? (
        <Skeleton className={styles.skeleton} />
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={6}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickFormatter={metric === "revenue" ? adminFormat.inrCompact : adminFormat.count}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTip metric={metric} grain={grain} />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {points.map((point) => (
                  <Cell key={point.start} fill={point.current ? "var(--chart-color-2)" : "var(--chart-color-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.swatch} />
              Full {unit}s
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchCurrent}`} />
              This {unit} so far
            </span>
          </div>
        </div>
      )}
    </section>
  );
};