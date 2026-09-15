import React from "react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "./Skeleton";
import type { SiteDailyPoint, ContentSurface } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { SURFACE_LABELS, SURFACE_COLORS } from "../helpers/adminContentSurfaces";
import styles from "./AdminContentActivity.module.css";

type Props = {
  daily: SiteDailyPoint[];
  days: number;
  isLoading: boolean;
  className?: string;
};

type Point = SiteDailyPoint & { label: string };

const SERIES: { key: "blog" | "knowledgeBase" | "examPage"; surface: ContentSurface }[] = [
  { key: "blog", surface: "blog" },
  { key: "knowledgeBase", surface: "knowledge_base" },
  { key: "examPage", surface: "exam_page" },
];

type TipProps = {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
};

const ChartTip = ({ active, payload }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const rows = SERIES.map((series) => ({ ...series, value: point[series.key] })).filter((row) => row.value > 0);

  return (
    <div className={styles.tip}>
      <span className={styles.tipDay}>{point.label}</span>
      {rows.length === 0 ? (
        <span className={styles.tipRow}>Nothing published</span>
      ) : (
        rows.map((row) => (
          <span key={row.surface} className={styles.tipRow}>
            <span className={styles.swatch} style={{ backgroundColor: SURFACE_COLORS[row.surface] }} />
            {adminFormat.count(row.value)} {SURFACE_LABELS[row.surface].toLowerCase()}
          </span>
        ))
      )}
    </div>
  );
};

export const AdminContentActivity = ({ daily, days, isLoading, className }: Props) => {
  const data: Point[] = daily.map((point) => ({ ...point, label: adminFormat.dayLabel(point.day) }));
  const showSkeleton = isLoading && daily.length === 0;
  const published = daily.reduce((sum, point) => sum + point.blog + point.knowledgeBase + point.examPage, 0);

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Publishing by day">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Publishing</h2>
          <span className={styles.subtitle}>{days === 1 ? "today so far" : `by day, last ${days} days`}</span>
        </div>
        <span className={styles.total}>
          {adminFormat.count(published)} {published === 1 ? "page" : "pages"}
        </span>
      </div>

      <div className={styles.legend}>
        {SERIES.map((series) => (
          <span key={series.surface} className={styles.legendItem}>
            <span className={styles.swatch} style={{ backgroundColor: SURFACE_COLORS[series.surface] }} />
            {SURFACE_LABELS[series.surface]}
          </span>
        ))}
      </div>

      {showSkeleton ? (
        <Skeleton className={styles.skeleton} />
      ) : published === 0 ? (
        <p className={styles.empty}>
          {days === 1 ? "Nothing has been published today." : "Nothing was published in this period."}
        </p>
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
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={30}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTip />} />
              {SERIES.map((series, index) => (
                <Bar
                  key={series.surface}
                  dataKey={series.key}
                  stackId="published"
                  fill={SURFACE_COLORS[series.surface]}
                  radius={index === SERIES.length - 1 ? [3, 3, 0, 0] : undefined}
                  maxBarSize={28}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
