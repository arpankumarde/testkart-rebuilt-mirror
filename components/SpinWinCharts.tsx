import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminFormat } from "../helpers/adminFormat";
import type { SpinDailyPoint, SpinRewardRow, SpinStats } from "../helpers/spinWinAnalytics";
import styles from "./SpinWinCharts.module.css";

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = {
  background: "var(--popup)",
  color: "var(--popup-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

/* Legend text in the foreground ink; recharts otherwise tints it with the series colour, which is too faint for pastel slices. */
const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12 },
  formatter: (value: string) => <span style={{ color: "var(--foreground)" }}>{value}</span>,
};

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; wide?: boolean; empty?: boolean }> = ({
  title,
  subtitle,
  children,
  wide,
  empty,
}) => (
  <section className={`${styles.card} ${wide ? styles.wide : ""}`} aria-label={title}>
    <div className={styles.head}>
      <h2 className={styles.title}>{title}</h2>
      {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
    </div>
    {empty ? <p className={styles.empty}>No data for this period yet.</p> : children}
  </section>
);

const labelled = (daily: SpinDailyPoint[]) => daily.map((d) => ({ ...d, label: adminFormat.dayLabel(d.day) }));

export const SpinDailySpinsChart: React.FC<{ daily: SpinDailyPoint[] }> = ({ daily }) => (
  <ChartCard title="Daily spins" subtitle="logged-in and guest" wide empty={daily.every((d) => d.spins === 0)}>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={labelled(daily)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tick={AXIS_TICK} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={AXIS_TICK} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend {...LEGEND_PROPS} />
        <Line type="monotone" dataKey="spins" name="All spins" stroke="var(--chart-color-1)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="userSpins" name="Logged in" stroke="var(--chart-color-2)" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="guestSpins" name="Guest" stroke="var(--chart-color-5)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const SpinRewardDistributionChart: React.FC<{ rewards: SpinRewardRow[] }> = ({ rewards }) => {
  const data = rewards.filter((r) => r.spins > 0);
  return (
    <ChartCard title="Rewards won" subtitle="share of spins" empty={data.length === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="spins" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={1} stroke="var(--muted-foreground)" strokeWidth={0.75}>
            {data.map((r) => (
              <Cell key={r.rewardId} fill={r.segmentColor} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => adminFormat.count(value)} />
          <Legend {...LEGEND_PROPS} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const SpinParticipationChart: React.FC<{ stats: SpinStats }> = ({ stats }) => {
  const data = [
    { name: "Logged in", value: stats.userSpins, color: "var(--chart-color-2)" },
    { name: "Guest", value: stats.guestSpins, color: "var(--chart-color-5)" },
  ];
  return (
    <ChartCard title="Logged-in vs guest" subtitle="spins" empty={stats.totalSpins === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} stroke="var(--surface)">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => adminFormat.count(value)} />
          <Legend {...LEGEND_PROPS} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const SpinRedemptionChart: React.FC<{ rewards: SpinRewardRow[] }> = ({ rewards }) => {
  const data = rewards.filter((r) => r.coupons > 0 || r.claimed > 0);
  return (
    <ChartCard title="Coupon redemption" subtitle="by reward" empty={data.length === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ ...AXIS_TICK, fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={52} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={AXIS_TICK} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
          <Legend {...LEGEND_PROPS} />
          <Bar dataKey="coupons" name="Issued" fill="var(--chart-color-3)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="redeemed" name="Redeemed" fill="var(--chart-color-2)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const SpinRevenueDiscountChart: React.FC<{ daily: SpinDailyPoint[] }> = ({ daily }) => (
  <ChartCard title="Revenue vs discount" subtitle="spin-coupon orders by day" wide empty={daily.every((d) => d.revenue === 0 && d.discount === 0)}>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={labelled(daily)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} tick={AXIS_TICK} />
        <YAxis tickFormatter={adminFormat.inrCompact} tickLine={false} axisLine={false} width={52} tick={AXIS_TICK} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} formatter={(value: number) => adminFormat.inr(value)} />
        <Legend {...LEGEND_PROPS} />
        <Bar dataKey="revenue" name="Revenue" fill="var(--chart-color-1)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="discount" name="Discount" fill="var(--chart-color-4)" radius={[3, 3, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const SpinChartGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className={styles.grid}>{children}</div>;