import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from "./Skeleton";
import { OutputType as SummaryOutputType } from "../endpoints/admin/ai-usage/summary_GET.schema";
import styles from "./AIUsageStats.module.css";

const FEATURE_LABELS: Record<string, string> = {
  question_generation: "Question Generation",
  rewrite: "AI Rewrite",
  generate_all: "Generate All",
};

type StatCardProps = {
  title: string;
  value?: string;
  subtext?: string;
  isLoading: boolean;
};

const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, isLoading }) => (
  <div className={styles.statCard}>
    {isLoading ? (
      <>
        <Skeleton className={styles.statValueSkeleton} />
        <Skeleton className={styles.statTitleSkeleton} />
      </>
    ) : (
      <>
        <div className={styles.statValue}>{value ?? 'N/A'}</div>
        <div className={styles.statTitle}>{title}</div>
        {subtext && <div className={styles.statSubtext}>{subtext}</div>}
      </>
    )}
  </div>
);

type AIUsageStatsProps = {
  summary?: SummaryOutputType;
  isLoading: boolean;
};

export const AIUsageStats: React.FC<AIUsageStatsProps> = ({ summary, isLoading }) => {
  return (
    <>
      <section className={styles.statsGrid}>
        <StatCard
          title="Total AI Attempts"
          value={summary?.totalAttempts.toLocaleString('en-IN')}
          isLoading={isLoading}
        />
        <StatCard
          title="Teacher Adoption"
          value={summary ? `${summary.activeTeachersCount} / ${summary.totalTeachersCount}` : undefined}
          subtext={summary ? `${summary.adoptionRate.toFixed(1)}% of teachers have used AI` : undefined}
          isLoading={isLoading}
        />
        <StatCard
          title="Success Rate"
          value={summary ? `${summary.successRate.toFixed(1)}%` : undefined}
          subtext={summary ? `${summary.doneCount} done, ${summary.failedCount} failed` : undefined}
          isLoading={isLoading}
        />
        <StatCard
          title="Pending"
          value={summary?.pendingCount.toLocaleString('en-IN')}
          isLoading={isLoading}
        />
        <StatCard
          title="Avg. Duration"
          value={summary?.avgDurationMs != null ? `${(summary.avgDurationMs / 1000).toFixed(1)}s` : (isLoading ? undefined : 'N/A')}
          isLoading={isLoading}
        />
      </section>

      <section className={styles.chartsRow}>
        <div className={styles.chartContainer}>
          <h2>Attempts (Last 14 Days)</h2>
          {summary && (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={summary.dailyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="aiUsageTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--primary)" fill="url(#aiUsageTrendFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.chartContainer}>
          <h2>By Feature</h2>
          <div className={styles.featureBreakdown}>
            {summary?.byFeature.map(f => {
              const pct = summary.totalAttempts > 0 ? (f.totalAttempts / summary.totalAttempts) * 100 : 0;
              return (
                <div key={f.feature} className={styles.featureRow}>
                  <div className={styles.featureRowHeader}>
                    <span className={styles.featureName}>{FEATURE_LABELS[f.feature] ?? f.feature}</span>
                    <span className={styles.featureCount}>{f.totalAttempts}</span>
                  </div>
                  <div className={styles.featureBar}>
                    <div className={styles.featureBarFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.featureStats}>
                    <span>{f.doneCount} done</span>
                    <span>{f.failedCount} failed</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};
