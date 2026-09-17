import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useTeacherDashboardOverview } from "../helpers/useTeacherDashboardOverview";
import {
  TeacherOverviewRange,
  TeacherOverviewRangeValues,
} from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Skeleton } from "../components/Skeleton";
import { TeacherOverviewAttention } from "../components/TeacherOverviewAttention";
import { TeacherOverviewNextSteps } from "../components/TeacherOverviewNextSteps";
import { TeacherOverviewKpis } from "../components/TeacherOverviewKpis";
import { TeacherOverviewCatalogue } from "../components/TeacherOverviewCatalogue";
import { TeacherOverviewEarningsChart } from "../components/TeacherOverviewEarningsChart";
import { TeacherOverviewTopSellers } from "../components/TeacherOverviewTopSellers";
import { TeacherOverviewRecentSales } from "../components/TeacherOverviewRecentSales";
import { TeacherOverviewGuides } from "../components/TeacherOverviewGuides";
import { TeamStatusBanner } from "../components/TeamStatusBanner";
import { AiConnectorCard } from "../components/AiConnectorCard";
import styles from "./teacher.dashboard.module.css";

const RANGE_DAYS: Record<TeacherOverviewRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<TeacherOverviewRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
};
const RANGE_OPTIONS = TeacherOverviewRangeValues.map((value) => ({
  value,
  label: RANGE_LABELS[value],
  ariaLabel: `Last ${RANGE_LABELS[value]}`,
}));

// The dashboard always opens on 30 days. The choice deliberately does NOT
// persist across visits: a remembered range meant someone who once clicked
// 90 days kept landing on it, which reads as the default being wrong.
const DEFAULT_RANGE: TeacherOverviewRange = "30d";

const TeacherDashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const [range, setRange] = useState<TeacherOverviewRange>(DEFAULT_RANGE);

  const enabled = authState.type === "authenticated";
  const { data, isFetching, isError, error, refetch } = useTeacherDashboardOverview(range, enabled);

  if (authState.type !== "authenticated") {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "2rem", width: "12rem" }} />
        <Skeleton style={{ height: "9rem", width: "100%", borderRadius: "var(--radius-lg)" }} />
        <Skeleton style={{ height: "10rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const days = data?.days ?? RANGE_DAYS[range];
  const daily = data?.daily ?? [];
  const totals = data?.totals;
  const publishedCount = totals
    ? totals.publishedTests + totals.publishedCourses + totals.publishedProducts + totals.publishedBundles
    : 0;
  // Team managers run the catalogue; the owner's earnings, sale amounts and balance stay hidden.
  const showMoney = authState.user.teacherRole !== "manager";

  return (
    <>
      <Helmet>
        <title>Overview - Testkart for Teachers</title>
        <meta name="description" content="Your earnings, sales and students on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Overview</h1>
          <div className={styles.controls}>
            <SegmentedControl
              value={range}
              onValueChange={setRange}
              options={RANGE_OPTIONS}
              aria-label="Period"
              className={styles.rangeGroup}
            />
            <Button
              variant="outline"
              size="icon-lg"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className={styles.refresh}
            >
              <RefreshCw size={16} className={isFetching ? styles.spin : undefined} />
            </Button>
          </div>
        </header>

        {isError && (
          <div className={styles.error} role="alert">
            Your dashboard could not be loaded.{" "}
            {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div className={`${styles.content} ${isFetching && data ? styles.busy : ""}`} aria-busy={isFetching}>
          <TeamStatusBanner />

          <TeacherOverviewAttention attention={data?.attention} />

          <TeacherOverviewNextSteps user={authState.user} publishedCount={publishedCount} />

          <AiConnectorCard audience="teacher" />

          <TeacherOverviewKpis kpis={data?.kpis} daily={daily} isLoading={isFetching} showEarnings={showMoney} />

          <TeacherOverviewCatalogue totals={totals} />

          {showMoney ? (
            <div className={styles.splitRow}>
              <TeacherOverviewEarningsChart daily={daily} days={days} isLoading={isFetching} />
              <TeacherOverviewGuides />
            </div>
          ) : (
            <TeacherOverviewGuides />
          )}

          <div className={styles.splitRow}>
            <TeacherOverviewTopSellers
              sellers={data?.topSellers ?? []}
              days={days}
              isLoading={isFetching}
              showEarnings={showMoney}
            />
            <TeacherOverviewRecentSales
              sales={data?.recentSales ?? []}
              isLoading={isFetching}
              showAmounts={showMoney}
            />
          </div>

          {totals && (
            <footer className={styles.totals} aria-label="Your totals">
              {showMoney && (
                <div className={styles.total}>
                  <span className={styles.totalValue}>{adminFormat.inr(totals.availableBalance)}</span>
                  <span className={styles.totalLabel}>available to withdraw</span>
                </div>
              )}
              <div className={styles.total}>
                <span className={styles.totalValue}>{adminFormat.count(totals.students)}</span>
                <span className={styles.totalLabel}>students all time</span>
              </div>
              {showMoney && (
                <div className={styles.total}>
                  <span className={styles.totalValue}>{adminFormat.inr(totals.lifetimeEarnings)}</span>
                  <span className={styles.totalLabel}>earned all time</span>
                </div>
              )}
            </footer>
          )}
        </div>
      </div>
    </>
  );
};

export default TeacherDashboardPage;
