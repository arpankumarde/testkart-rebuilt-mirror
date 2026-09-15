import React from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "./Skeleton";
import type { ContentDailyPoint, ContentKind } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { CONTENT_KIND_LABELS, CONTENT_KIND_COLORS } from "../helpers/adminCatalogueKinds";
import styles from "./AdminCatalogueActivity.module.css";

type Props = {
  daily: ContentDailyPoint[];
  days: number;
  isLoading: boolean;
  className?: string;
};

type Point = ContentDailyPoint & { label: string };

const SERIES: { key: keyof ContentDailyPoint; kind: ContentKind }[] = [
  { key: "mockTest", kind: "mock_test" },
  { key: "digitalProduct", kind: "digital_product" },
  { key: "course", kind: "course" },
  { key: "liveTest", kind: "live_test" },
  { key: "courseBundle", kind: "course_bundle" },
];

type TipProps = {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
};

const ChartTip = ({ active, payload }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const rows = SERIES.map((series) => ({ ...series, value: Number(point[series.key]) })).filter(
    (row) => row.value > 0
  );

  return (
    <div className={styles.tip}>
      <span className={styles.tipDay}>{point.label}</span>
      {rows.length === 0 ? (
        <span className={styles.tipRow}>Nothing created</span>
      ) : (
        rows.map((row) => (
          <span key={row.kind} className={styles.tipRow}>
            <span className={styles.swatch} style={{ backgroundColor: CONTENT_KIND_COLORS[row.kind] }} />
            {adminFormat.count(row.value)} {CONTENT_KIND_LABELS[row.kind].toLowerCase()}
          </span>
        ))
      )}
      <span className={styles.tipRow}>
        <span className={styles.swatchLine} />
        {adminFormat.count(point.questions)} questions
      </span>
    </div>
  );
};

export const AdminCatalogueActivity = ({ daily, days, isLoading, className }: Props) => {
  const data: Point[] = daily.map((point) => ({ ...point, label: adminFormat.dayLabel(point.day) }));
  const showSkeleton = isLoading && daily.length === 0;
  const created = daily.reduce(
    (sum, point) => sum + point.mockTest + point.course + point.digitalProduct + point.liveTest + point.courseBundle,
    0
  );

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Content created by day">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Content created</h2>
          <span className={styles.subtitle}>by day, last {days} days</span>
        </div>
        <span className={styles.total}>{adminFormat.count(created)} items</span>
      </div>

      <div className={styles.legend}>
        {SERIES.map((series) => (
          <span key={series.kind} className={styles.legendItem}>
            <span className={styles.swatch} style={{ backgroundColor: CONTENT_KIND_COLORS[series.kind] }} />
            {CONTENT_KIND_LABELS[series.kind]}
          </span>
        ))}
        <span className={styles.legendItem}>
          <span className={styles.swatchLine} />
          Questions
        </span>
      </div>

      {showSkeleton ? (
        <Skeleton className={styles.skeleton} />
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={days <= 7 ? 0 : "preserveStartEnd"}
                minTickGap={18}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                yAxisId="left"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={36}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTip />} />
              {SERIES.map((series, index) => (
                <Bar
                  key={series.kind}
                  yAxisId="left"
                  dataKey={series.key}
                  stackId="content"
                  fill={CONTENT_KIND_COLORS[series.kind]}
                  radius={index === SERIES.length - 1 ? [3, 3, 0, 0] : undefined}
                  maxBarSize={28}
                />
              ))}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="questions"
                stroke="var(--foreground)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: "var(--foreground)" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
