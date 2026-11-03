import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { useLocation } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useTeacherDashboardOverview } from "../helpers/useTeacherDashboardOverview";
import {
  TeacherOverviewRange,
  TeacherOverviewRangeValues,
} from "../endpoints/teacher/dashboard/overview_GET.schema";
import { teacherStage } from "../helpers/teacherStage";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Skeleton } from "../components/Skeleton";
import { TeacherOverviewStagePanel } from "../components/TeacherOverviewStagePanel";
import { TeacherOverviewMoneyPanel } from "../components/TeacherOverviewMoneyPanel";
import { TeacherOverviewNeedsYou } from "../components/TeacherOverviewNeedsYou";
import { TeacherOverviewShelf } from "../components/TeacherOverviewShelf";
import { TeacherOverviewProfileChecklist } from "../components/TeacherOverviewProfileChecklist";
import { TeacherOverviewCreatorBonus } from "../components/TeacherOverviewCreatorBonus";
import { TeacherOverviewEarningsChart } from "../components/TeacherOverviewEarningsChart";
import { TeacherOverviewTopSellers } from "../components/TeacherOverviewTopSellers";
import { TeacherOverviewHelpStrip } from "../components/TeacherOverviewHelpStrip";
import { TeamStatusBanner } from "../components/TeamStatusBanner";
import { AiConnectorCard, AI_CONNECTOR_ANCHOR } from "../components/AiConnectorCard";
import styles from "./teacher.dashboard.module.css";

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

// The period always opens on 30 days and is not remembered: a remembered
// range meant someone who once clicked 90 days kept landing on it.
const DEFAULT_RANGE: TeacherOverviewRange = "30d";

const TOP_SELLERS_SHOWN = 3;

const greeting = (name: string) => {
  const first = name.trim().split(/\s+/)[0];
  return first ? `Hi, ${first}` : "Hi there";
};

const PageSkeleton = () => (
  <div className={styles.page} aria-busy="true">
    <Skeleton style={{ height: "2rem", width: "12rem" }} />
    <Skeleton style={{ height: "15rem", width: "100%", borderRadius: "1.5rem" }} />
    <Skeleton style={{ height: "6rem", width: "100%", borderRadius: "1rem" }} />
  </div>
);

/*
 * The teacher's home: one panel with the next step (or this period's money
 * for sellers), then only what needs them. Most teachers have nothing live
 * yet, so the page stays short and every block hides when it has nothing to
 * say. The AI connector setup is reached from Settings, which links here
 * with its anchor, so it renders only on that visit.
 */
const TeacherDashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const location = useLocation();
  const [range, setRange] = useState<TeacherOverviewRange>(DEFAULT_RANGE);
  const enabled = authState.type === "authenticated";
  const { data: raw, isFetching, isError, error, refetch } = useTeacherDashboardOverview(range, enabled, "always");
  // A response cached or served before the stage fields shipped lacks them.
  const data = raw && {
    ...raw,
    lastDraft: raw.lastDraft ?? null,
    inReview: raw.inReview ?? [],
    rejected: raw.rejected ?? [],
    firstContentType: raw.firstContentType ?? "mock_test",
  };

  if (authState.type !== "authenticated") return <PageSkeleton />;

  const user = authState.user;
  const isManager = user.teacherRole === "manager";
  const title = greeting(user.displayName);
  const showAiConnector = location.hash === `#${AI_CONNECTOR_ANCHOR}`;

  const head = (
    <Helmet>
      <title>Overview - Testkart for Teachers</title>
      <meta name="description" content="Your next step, your content and your earnings on Testkart." />
    </Helmet>
  );

  if (!data) {
    if (!isError) return <PageSkeleton />;
    return (
      <div className={styles.page}>
        {head}
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.error} role="alert">
          <p className={styles.errorText}>
            Could not load. {error instanceof Error ? error.message : "Check your connection."}
          </p>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const stage = teacherStage(data);
  const selling = stage === "selling";

  return (
    <>
      {head}
      <div className={`${styles.page} ${isFetching ? styles.busy : ""}`} aria-busy={isFetching}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {selling && (
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
          )}
        </header>

        <div className={styles.main}>
          <TeamStatusBanner />

          {selling ? (
            <TeacherOverviewMoneyPanel data={data} />
          ) : (
            <TeacherOverviewStagePanel stage={stage} data={data} profileSlug={isManager ? null : user.slug ?? null} />
          )}

          <TeacherOverviewNeedsYou
            attention={data.attention}
            availableBalance={data.totals.availableBalance}
            rejected={data.rejected}
            skipFirstRejected={stage === "review"}
            hideReviewCounts={stage === "review"}
            hideBank
          />

          {selling && (
            <div className={styles.splitRow}>
              <TeacherOverviewEarningsChart daily={data.daily} days={data.days} isLoading={isFetching} />
              <TeacherOverviewTopSellers
                sellers={data.topSellers.slice(0, TOP_SELLERS_SHOWN)}
                days={data.days}
                isLoading={isFetching}
                showEarnings={!isManager}
              />
            </div>
          )}

          {stage !== "start" && <TeacherOverviewShelf totals={data.totals} />}

          <TeacherOverviewCreatorBonus />

          <TeacherOverviewProfileChecklist user={user} />

          {showAiConnector && <AiConnectorCard audience="teacher" />}

          <TeacherOverviewHelpStrip />
        </div>
      </div>
    </>
  );
};

export default TeacherDashboardPage;
