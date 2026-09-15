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
import type { TeacherDailyPoint } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./TeacherOverviewEarningsChart.module.css";

type Props = {
  daily: TeacherDailyPoint[];
  days: number;
  isLoading: boolean;
  className?: string;
};

type TipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: TeacherDailyPoint & { label: string } }>;
};

const ChartTip = ({ active, payload }: TipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span className={styles.tipDay}>{point.label}</span>
      <span className={styles.tipRow}>
        <span className={styles.swatchBar} />
        {adminFormat.inr(point.earnings)}
      </span>
      <span className={styles.tipRow}>
        <span className={styles.swatchLine} />
        {adminFormat.count(point.sales)} {point.sales === 1 ? "sale" : "sales"}
      </span>
    </div>
  );
};

export const TeacherOverviewEarningsChart = ({ daily, days, isLoading, className }: Props) => {
  const data = daily.map((point) => ({ ...point, label: adminFormat.dayLabel(point.day) }));
  const showSkeleton = isLoading && daily.length === 0;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Earnings and sales by day">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>Earnings and sales</h2>
          <span className={styles.subtitle}>last {days} days</span>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.swatchBar} />
            earnings
          </span>
          <span className={styles.legendItem}>
            <span className={styles.swatchLine} />
            sales
          </span>
        </div>
      </div>

      {showSkeleton ? (
        <Skeleton className={styles.skeleton} />
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="32%">
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
                tickFormatter={adminFormat.inrCompact}
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={30}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTip />} />
              <Bar yAxisId="left" dataKey="earnings" fill="var(--chart-color-1)" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="sales"
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
