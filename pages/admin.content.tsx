import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { RefreshCw } from "lucide-react";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useAdminSiteContentDashboard } from "../helpers/useAdminSiteContentDashboard";
import { SiteRange, SiteRangeValues } from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Skeleton } from "../components/Skeleton";
import { AdminContentQueues } from "../components/AdminContentQueues";
import { AdminContentKpis } from "../components/AdminContentKpis";
import { AdminContentLibrary } from "../components/AdminContentLibrary";
import { AdminContentActivity } from "../components/AdminContentActivity";
import { AdminContentMetadata } from "../components/AdminContentMetadata";
import { AdminContentTopReads } from "../components/AdminContentTopReads";
import { AdminContentExamPages } from "../components/AdminContentExamPages";
import { AdminContentFreshness } from "../components/AdminContentFreshness";
import styles from "./admin.content.module.css";

const RANGE_KEY = "admin_site_content_range";
const RANGE_DAYS: Record<SiteRange, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<SiteRange, string> = { "1d": "Today", "7d": "7 days", "30d": "30 days", "90d": "90 days" };

// "Last Today" would be nonsense, so the toggle's accessible name is its own map.
const RANGE_ARIA_LABELS: Record<SiteRange, string> = {
  "1d": "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};
const RANGE_OPTIONS = SiteRangeValues.map((value) => ({
  value,
  label: RANGE_LABELS[value],
  ariaLabel: RANGE_ARIA_LABELS[value],
}));

const readStoredRange = (): SiteRange => {
  try {
    const stored = window.localStorage.getItem(RANGE_KEY);
    if (stored && (SiteRangeValues as readonly string[]).includes(stored)) return stored as SiteRange;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return "30d";
};

const AdminContentPage: React.FC = () => {
  const { authState } = useAdminAuth();
  const [range, setRange] = useState<SiteRange>("30d");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setRange(readStoredRange());
  }, []);

  const enabled = authState.type === "authenticated";
  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useAdminSiteContentDashboard(range, enabled);

  useEffect(() => {
    setNow(Date.now());
  }, [dataUpdatedAt]);

  const changeRange = (value: SiteRange) => {
    setRange(value);
    try {
      window.localStorage.setItem(RANGE_KEY, value);
    } catch {
      // Preference simply resets next visit.
    }
  };

  if (authState.type !== "authenticated") {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "2rem", width: "14rem" }} />
        <Skeleton style={{ height: "9rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: "10rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const days = data?.days ?? RANGE_DAYS[range];
  const daily = data?.daily ?? [];

  const totals = data
    ? [
        { value: adminFormat.count(data.totals.articles), label: "articles" },
        { value: adminFormat.count(data.totals.articleViews), label: "article views" },
        { value: adminFormat.count(data.totals.reactions), label: "reactions" },
        { value: adminFormat.count(data.totals.comments), label: "comments" },
        { value: adminFormat.count(data.totals.categories), label: "categories" },
        { value: adminFormat.count(data.totals.tags), label: "tags" },
        { value: adminFormat.count(data.totals.examPages), label: "exam pages" },
        { value: adminFormat.count(data.totals.staticPages), label: "static pages" },
        { value: adminFormat.count(data.totals.careers), label: "job posts" },
        { value: adminFormat.count(data.totals.applications), label: "applications" },
        { value: adminFormat.count(data.totals.emailTemplates), label: "email templates" },
      ]
    : [];

  return (
    <>
      <Helmet>
        <title>Content - Testkart Admin</title>
        <meta name="description" content="Editorial and SEO health across everything the team publishes." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Content</h1>
            <p className={styles.lede}>
              The pages Testkart writes - blog, help pages, exam pages and the rest of the site.
            </p>
          </div>
          <div className={styles.controls}>
            {dataUpdatedAt > 0 && (
              <span className={styles.updated}>Updated {adminFormat.relativeTime(new Date(dataUpdatedAt), now)}</span>
            )}
            <SegmentedControl
              value={range}
              onValueChange={changeRange}
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
            The content dashboard could not be loaded.{" "}
            {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div className={`${styles.content} ${isFetching && data ? styles.busy : ""}`} aria-busy={isFetching}>
          <AdminContentQueues queues={data?.queues} isLoading={isFetching} />

          <AdminContentKpis kpis={data?.kpis} daily={daily} days={days} isLoading={isFetching} />

          <AdminContentLibrary surfaces={data?.surfaces ?? []} days={days} isLoading={isFetching} />

          <div className={styles.chartRow}>
            <AdminContentActivity daily={daily} days={days} isLoading={isFetching} />
            <AdminContentMetadata metadata={data?.metadata ?? []} isLoading={isFetching} />
          </div>

          <div className={styles.tableRow}>
            <AdminContentTopReads topReads={data?.topReads ?? []} isLoading={isFetching} />
            <AdminContentExamPages
              examPageTypes={data?.examPageTypes ?? []}
              examsWithPages={data?.totals.examsWithPages ?? 0}
              exams={data?.totals.exams ?? 0}
              isLoading={isFetching}
            />
          </div>

          <AdminContentFreshness stale={data?.stale ?? []} now={now} isLoading={isFetching} />

          {totals.length > 0 && (
            <footer className={styles.totals} aria-label="Content totals">
              {totals.map((total) => (
                <div key={total.label} className={styles.total}>
                  <span className={styles.totalValue}>{total.value}</span>
                  <span className={styles.totalLabel}>{total.label}</span>
                </div>
              ))}
            </footer>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminContentPage;
