import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { RefreshCw } from "lucide-react";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useAdminCatalogueDashboard } from "../helpers/useAdminCatalogueDashboard";
import { ContentRange, ContentRangeValues } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Skeleton } from "../components/Skeleton";
import { AdminCatalogueQueues } from "../components/AdminCatalogueQueues";
import { AdminCatalogueKpis } from "../components/AdminCatalogueKpis";
import { AdminCatalogueActivity } from "../components/AdminCatalogueActivity";
import { AdminCataloguePipeline } from "../components/AdminCataloguePipeline";
import { AdminCatalogueCoverage } from "../components/AdminCatalogueCoverage";
import { AdminCatalogueLeaders } from "../components/AdminCatalogueLeaders";
import { AdminCatalogueRecent } from "../components/AdminCatalogueRecent";
import styles from "./admin.catalogue.module.css";

const RANGE_KEY = "admin_catalogue_range";
const RANGE_DAYS: Record<ContentRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<ContentRange, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };
const RANGE_OPTIONS = ContentRangeValues.map((value) => ({
  value,
  label: RANGE_LABELS[value],
  ariaLabel: `Last ${RANGE_LABELS[value]}`,
}));

const readStoredRange = (): ContentRange => {
  try {
    const stored = window.localStorage.getItem(RANGE_KEY);
    if (stored && (ContentRangeValues as readonly string[]).includes(stored)) return stored as ContentRange;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return "30d";
};

const AdminCataloguePage: React.FC = () => {
  const { authState } = useAdminAuth();
  const [range, setRange] = useState<ContentRange>("30d");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setRange(readStoredRange());
  }, []);

  const enabled = authState.type === "authenticated";
  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useAdminCatalogueDashboard(range, enabled);

  useEffect(() => {
    setNow(Date.now());
  }, [dataUpdatedAt]);

  const changeRange = (value: ContentRange) => {
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
        { value: adminFormat.count(data.totals.exams), label: "exams" },
        { value: adminFormat.count(data.totals.examCategories), label: "exam categories" },
        { value: adminFormat.count(data.totals.testItems), label: "tests inside series" },
        { value: adminFormat.count(data.totals.questions), label: "questions in tests" },
        { value: adminFormat.count(data.totals.bankQuestions), label: "questions in the bank" },
        { value: adminFormat.count(data.totals.sections), label: "course sections" },
        { value: adminFormat.count(data.totals.lessons), label: "course lessons" },
      ]
    : [];

  return (
    <>
      <Helmet>
        <title>Catalogue - Testkart Admin</title>
        <meta name="description" content="Catalogue health, publishing activity and exam coverage." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Catalogue</h1>
            <p className={styles.lede}>What the catalogue holds, what is moving, and where the gaps are.</p>
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
          <AdminCatalogueQueues queues={data?.queues} isLoading={isFetching} />

          <AdminCatalogueKpis kpis={data?.kpis} daily={daily} days={days} isLoading={isFetching} />

          <AdminCataloguePipeline pipeline={data?.pipeline ?? []} days={days} isLoading={isFetching} />

          <div className={styles.chartRow}>
            <AdminCatalogueActivity daily={daily} days={days} isLoading={isFetching} />
            <AdminCatalogueCoverage coverage={data?.coverage ?? []} isLoading={isFetching} />
          </div>

          <div className={styles.tableRow}>
            <AdminCatalogueLeaders
              topContent={data?.topContent ?? []}
              topCreators={data?.topCreators ?? []}
              days={days}
              isLoading={isFetching}
            />
            <AdminCatalogueRecent recent={data?.recent ?? []} now={now} isLoading={isFetching} />
          </div>

          {totals.length > 0 && (
            <footer className={styles.totals} aria-label="Catalogue totals">
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

export default AdminCataloguePage;
