import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { AnalyticsRange, AnalyticsRangeValues } from "../helpers/teacherAnalyticsTime";
import { ANALYTICS_RANGE_LABELS } from "../helpers/teacherAnalyticsLabels";
import { useTeacherAnalyticsSummary, useRefreshTeacherAnalytics } from "../helpers/useTeacherAnalytics";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { TeacherAnalyticsKpis } from "../components/TeacherAnalyticsKpis";
import { TeacherAnalyticsAcademy } from "../components/TeacherAnalyticsAcademy";
import { TeacherAnalyticsSales } from "../components/TeacherAnalyticsSales";
import { TeacherAnalyticsProducts } from "../components/TeacherAnalyticsProducts";
import { TeacherAnalyticsStudents } from "../components/TeacherAnalyticsStudents";
import { TeacherAnalyticsReviews } from "../components/TeacherAnalyticsReviews";
import styles from "./teacher.analytics.module.css";

// Academy opens first: visits, share links and payments are what a teacher
// can act on today.
const TABS = ["academy", "sales", "products", "students", "reviews"] as const;
type AnalyticsTab = (typeof TABS)[number];
const TAB_LABELS: Record<AnalyticsTab, string> = {
  academy: "Academy",
  sales: "Sales",
  products: "Products",
  students: "Students",
  reviews: "Reviews",
};

const RANGE_OPTIONS = AnalyticsRangeValues.map((value) => ({
  value,
  label: ANALYTICS_RANGE_LABELS[value],
  ariaLabel: `Last ${ANALYTICS_RANGE_LABELS[value]}`,
}));

// Opens on 30 days every visit, as Overview does: a remembered range read as
// the default being wrong.
const DEFAULT_RANGE: AnalyticsRange = "30d";

const TeacherAnalyticsPage: React.FC = () => {
  const { authState } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE);
  const { read, write } = useListUrlParams();
  const tab = read<AnalyticsTab>("tab", TABS, "academy");
  const refresh = useRefreshTeacherAnalytics();

  const enabled = authState.type === "authenticated";
  const summary = useTeacherAnalyticsSummary(range, enabled);

  if (authState.type !== "authenticated") {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "2rem", width: "12rem" }} />
        <Skeleton style={{ height: "9rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  // Labels follow the data on screen, which is the previous range's until the new one arrives.
  const rangeLabel = ANALYTICS_RANGE_LABELS[summary.data?.range ?? range];
  const summaryBusy = summary.isFetching && !!summary.data;

  return (
    <>
      <Helmet>
        <title>Analytics - Testkart for Teachers</title>
        <meta name="description" content="What sells, who buys and how your students do on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Analytics">
          <SegmentedControl value={range} onValueChange={setRange} options={RANGE_OPTIONS} aria-label="Period" />
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => refresh()}
            disabled={summary.isFetching}
            aria-label="Refresh"
            className={styles.refresh}
          >
            <RefreshCw size={16} className={summary.isFetching ? styles.spin : undefined} />
          </Button>
        </ConsolePageHeader>

        {summary.isError && (
          <div className={styles.error} role="alert">
            Your key figures could not be loaded.{" "}
            {summary.error instanceof Error ? summary.error.message : "Try again in a moment."}
          </div>
        )}

        <div className={summaryBusy ? styles.busy : undefined} aria-busy={summary.isFetching}>
          <TeacherAnalyticsKpis summary={summary.data} isLoading={summary.isFetching} rangeLabel={rangeLabel} />
        </div>

        <ConsoleListToolbar
          tabs={TABS.map((value) => ({ value, label: TAB_LABELS[value] }))}
          value={tab}
          onValueChange={(value) =>
            write({ tab: value === "academy" ? null : value, kind: null, sort: null, dir: null, page: null })
          }
          tabsLabel="Analytics sections"
        />

        {tab === "academy" && <TeacherAnalyticsAcademy range={range} enabled={enabled} />}
        {tab === "sales" && <TeacherAnalyticsSales range={range} enabled={enabled} />}
        {tab === "products" && <TeacherAnalyticsProducts range={range} enabled={enabled} />}
        {tab === "students" && <TeacherAnalyticsStudents range={range} enabled={enabled} />}
        {tab === "reviews" && <TeacherAnalyticsReviews range={range} enabled={enabled} />}
      </div>
    </>
  );
};

export default TeacherAnalyticsPage;