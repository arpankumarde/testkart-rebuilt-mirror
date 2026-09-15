import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { IndianRupee, Users, ShoppingCart, BookOpen } from "lucide-react";
import { useAdminStatsQuery } from "../helpers/useAdminStats";
import { useAdminDashboardTrendsQuery } from "../helpers/useAdminDashboardTrends";
import { adminFormat } from "../helpers/adminFormat";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import styles from "./admin.dashboard.old.module.css";

type Period = "daily" | "weekly" | "monthly";

const PERIODS: Period[] = ["daily", "weekly", "monthly"];
const PERIOD_LABELS: Record<Period, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

const QUICK_LINKS = [
  { label: "Teachers", path: "/admin/teachers" },
  { label: "Students", path: "/admin/students" },
  { label: "Transactions", path: "/admin/transactions" },
  { label: "Finance", path: "/admin/finance" },
  { label: "Test series", path: "/admin/test-series" },
  { label: "Live tests", path: "/admin/live-tests" },
];

const tooltipStyle = {
  background: "var(--popup)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: "0.8125rem",
  color: "var(--popup-foreground)",
};

const PeriodSwitch = ({ value, onChange, label }: { value: Period; onChange: (p: Period) => void; label: string }) => (
  <div className={styles.switch} role="tablist" aria-label={label}>
    {PERIODS.map((period) => (
      <button
        key={period}
        type="button"
        role="tab"
        aria-selected={value === period}
        className={`${styles.switchButton} ${value === period ? styles.switchActive : ""}`}
        onClick={() => onChange(period)}
      >
        {PERIOD_LABELS[period]}
      </button>
    ))}
  </div>
);

const KpiCard = ({
  label,
  value,
  icon,
  isLoading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  isLoading: boolean;
}) => (
  <div className={styles.kpi}>
    {isLoading ? (
      <>
        <Skeleton style={{ height: "0.875rem", width: "8rem" }} />
        <Skeleton style={{ height: "2rem", width: "6rem", marginTop: "var(--spacing-3)" }} />
      </>
    ) : (
      <>
        <div className={styles.kpiHead}>
          <span className={styles.kpiLabel}>{label}</span>
          <span className={styles.kpiIcon}>{icon}</span>
        </div>
        <span className={styles.kpiValue}>{value}</span>
        <span className={styles.kpiNote}>This month</span>
      </>
    )}
  </div>
);

const MetricRow = ({
  label,
  value,
  tone,
  isLoading,
}: {
  label: string;
  value: number;
  tone?: "success" | "error" | "warning";
  isLoading: boolean;
}) => (
  <li className={styles.metricRow}>
    {isLoading ? (
      <>
        <Skeleton style={{ height: "0.875rem", width: "9rem" }} />
        <Skeleton style={{ height: "0.875rem", width: "2.5rem" }} />
      </>
    ) : (
      <>
        <span className={styles.metricLabel}>
          {tone && <span className={`${styles.dot} ${styles[`tone_${tone}`]}`} aria-hidden="true" />}
          {label}
        </span>
        <span className={styles.metricValue}>{adminFormat.count(value)}</span>
      </>
    )}
  </li>
);

const AdminDashboardOldPage: React.FC = () => {
  const { data: stats, isFetching, isError, error } = useAdminStatsQuery();
  const [userPeriod, setUserPeriod] = useState<Period>("monthly");
  const [revenuePeriod, setRevenuePeriod] = useState<Period>("monthly");
  const userTrends = useAdminDashboardTrendsQuery(userPeriod);
  const revenueTrends = useAdminDashboardTrendsQuery(revenuePeriod);

  const userGrowth = userTrends.data?.userGrowth ?? [];
  const totalTeachers = userGrowth.reduce((sum, row) => sum + row.teachers, 0);
  const totalStudents = userGrowth.reduce((sum, row) => sum + row.students, 0);
  const totalUsers = userGrowth.reduce((sum, row) => sum + row.total, 0);

  const revenueTrend = revenueTrends.data?.revenueTrend ?? [];
  const totalRevenue = revenueTrend.reduce((sum, row) => sum + row.revenue, 0);
  const totalOrders = revenueTrend.reduce((sum, row) => sum + row.orders, 0);

  const newUsers = stats ? stats.monthlyNewTeachers + stats.monthlyNewStudents : 0;

  return (
    <>
      <Helmet>
        <title>Dashboard (old) - Testkart Admin</title>
        <meta name="description" content="The previous Testkart admin dashboard metrics." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Dashboard (old)</h1>
          <span className={styles.subtitle}>The metrics from the previous dashboard, month to date and all time</span>
        </header>

        {isError && (
          <div className={styles.error} role="alert">
            Platform statistics could not be loaded. {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div className={styles.kpis}>
          <KpiCard
            label="This month's revenue"
            value={stats ? adminFormat.inr(stats.monthlyRevenue) : "₹0"}
            icon={<IndianRupee size={18} aria-hidden="true" />}
            isLoading={isFetching && !stats}
          />
          <KpiCard
            label="New users"
            value={adminFormat.count(newUsers)}
            icon={<Users size={18} aria-hidden="true" />}
            isLoading={isFetching && !stats}
          />
          <KpiCard
            label="Orders"
            value={stats ? adminFormat.count(stats.monthlyCompletedOrders) : "0"}
            icon={<ShoppingCart size={18} aria-hidden="true" />}
            isLoading={isFetching && !stats}
          />
          <KpiCard
            label="Tests published"
            value={stats ? adminFormat.count(stats.monthlyPublishedTests) : "0"}
            icon={<BookOpen size={18} aria-hidden="true" />}
            isLoading={isFetching && !stats}
          />
        </div>

        <div className={styles.charts}>
          <section className={styles.card} aria-label="User growth">
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>User growth</h2>
              <PeriodSwitch value={userPeriod} onChange={setUserPeriod} label="User growth period" />
            </div>
            {userTrends.isLoading ? (
              <Skeleton className={styles.chartSkeleton} />
            ) : (
              <>
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={userGrowth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        width={34}
                        allowDecimals={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                      <Legend wrapperStyle={{ fontSize: "0.8125rem", paddingTop: "0.5rem" }} />
                      <Bar dataKey="teachers" name="Teachers" stackId="a" fill="var(--chart-color-1)" />
                      <Bar dataKey="students" name="Students" stackId="a" fill="var(--chart-color-2)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className={styles.summary}>
                  Total new users in this period: <strong>{adminFormat.count(totalUsers)}</strong> (
                  {adminFormat.count(totalTeachers)} teachers, {adminFormat.count(totalStudents)} students)
                </p>
              </>
            )}
          </section>

          <section className={styles.card} aria-label="Revenue trends">
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Revenue trends</h2>
              <PeriodSwitch value={revenuePeriod} onChange={setRevenuePeriod} label="Revenue period" />
            </div>
            {revenueTrends.isLoading ? (
              <Skeleton className={styles.chartSkeleton} />
            ) : (
              <>
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="legacyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-color-1)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--chart-color-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        tickFormatter={adminFormat.inrCompact}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [adminFormat.inr(value), "Revenue"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--chart-color-1)"
                        strokeWidth={2}
                        fill="url(#legacyRevenueFill)"
                        dot={false}
                        activeDot={{ r: 4, fill: "var(--chart-color-1)", strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className={styles.summary}>
                  Total revenue: <strong>{adminFormat.inr(totalRevenue)}</strong> from {adminFormat.count(totalOrders)}{" "}
                  {totalOrders === 1 ? "order" : "orders"}
                </p>
              </>
            )}
          </section>
        </div>

        <div className={styles.panels}>
          <section className={styles.card} aria-label="Platform content">
            <h2 className={styles.cardTitle}>Platform content</h2>
            <ul className={styles.metrics}>
              <MetricRow label="Published tests" value={stats?.publishedTests ?? 0} isLoading={isFetching && !stats} />
              <MetricRow label="Published courses" value={stats?.publishedCourses ?? 0} isLoading={isFetching && !stats} />
              <MetricRow label="Published products" value={stats?.publishedProducts ?? 0} isLoading={isFetching && !stats} />
              <MetricRow label="Published bundles" value={stats?.publishedBundles ?? 0} isLoading={isFetching && !stats} />
              <MetricRow label="Active live tests" value={stats?.liveTests ?? 0} isLoading={isFetching && !stats} />
              <MetricRow
                label="Completed test attempts"
                value={stats?.completedTestAttempts ?? 0}
                isLoading={isFetching && !stats}
              />
            </ul>
          </section>

          <section className={styles.card} aria-label="Order health">
            <h2 className={styles.cardTitle}>Order health</h2>
            <ul className={styles.metrics}>
              <MetricRow
                label="Completed orders"
                value={stats?.totalCompletedOrders ?? 0}
                tone="success"
                isLoading={isFetching && !stats}
              />
              <MetricRow label="Failed orders" value={stats?.failedOrders ?? 0} tone="error" isLoading={isFetching && !stats} />
              <MetricRow
                label="Pending orders"
                value={stats?.pendingOrders ?? 0}
                tone="warning"
                isLoading={isFetching && !stats}
              />
            </ul>
          </section>
        </div>

        <section className={styles.card} aria-label="Quick actions">
          <h2 className={styles.cardTitle}>Quick actions</h2>
          <div className={styles.quickLinks}>
            {QUICK_LINKS.map((link) => (
              <Button key={link.path} asChild variant="outline" size="sm">
                <Link to={link.path}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
};

export default AdminDashboardOldPage;
