import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import styles from "./AIQuestionsStats.module.css";

export type StatsData = {
  totalQuestions: number;
  thisMonthCount: number;
  monthlyGrowthRate: number;
  customPromptsCount: number;
  markedForReviewCount: number;
  questionsByExam: { examName: string; count: number }[];
};

type StatCardProps = {
  title: string;
  value?: number;
  isLoading: boolean;
  badgeValue?: number;
  badgeType?: 'success' | 'destructive';
};

const StatCard: React.FC<StatCardProps> = ({ title, value, isLoading, badgeValue, badgeType }) => (
  <div className={styles.statCard}>
    {isLoading ? (
      <>
        <Skeleton className={styles.statValueSkeleton} />
        <Skeleton className={styles.statTitleSkeleton} />
      </>
    ) : (
      <>
        <div className={styles.statValue}>
          {value?.toLocaleString('en-IN') ?? 'N/A'}
          {badgeValue !== undefined && (
            <Badge variant={badgeType} className={styles.statBadge}>
              {badgeValue >= 0 ? '+' : ''}{badgeValue.toFixed(1)}%
            </Badge>
          )}
        </div>
        <div className={styles.statTitle}>{title}</div>
      </>
    )}
  </div>
);

type AIQuestionsStatsProps = {
  stats?: StatsData;
  isLoading: boolean;
};

export const AIQuestionsStats: React.FC<AIQuestionsStatsProps> = ({ stats, isLoading }) => {
  return (
    <>
      <section className={styles.statsGrid}>
        <StatCard title="Total AI Questions" value={stats?.totalQuestions} isLoading={isLoading} />
        <StatCard 
          title="Questions This Month" 
          value={stats?.thisMonthCount} 
          isLoading={isLoading}
          badgeValue={stats?.monthlyGrowthRate}
          badgeType={stats && stats.monthlyGrowthRate >= 0 ? 'success' : 'destructive'}
        />
        <StatCard title="With Custom Prompts" value={stats?.customPromptsCount} isLoading={isLoading} />
        <StatCard title="Marked For Review" value={stats?.markedForReviewCount} isLoading={isLoading} />
      </section>

      {stats && stats.questionsByExam.length > 0 && (
        <section className={styles.chartContainer}>
          <h2>Questions by Exam</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.questionsByExam} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="examName" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </>
  );
};