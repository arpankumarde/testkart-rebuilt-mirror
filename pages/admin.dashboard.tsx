import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { RefreshCw } from "lucide-react";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useAdminDashboardOverview } from "../helpers/useAdminDashboardOverview";
import { OverviewRange, OverviewRangeValues } from "../endpoints/admin/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { Button } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Skeleton } from "../components/Skeleton";
import { AdminAttentionBand } from "../components/AdminAttentionBand";
import { AdminKpiLedger } from "../components/AdminKpiLedger";
import { AdminRevenueChart } from "../components/AdminRevenueChart";
import { AdminRevenueMix } from "../components/AdminRevenueMix";
import { AdminTopSellers } from "../components/AdminTopSellers";
import { AdminRecentOrders } from "../components/AdminRecentOrders";
import { AiConnectorCard } from "../components/AiConnectorCard";
import styles from "./admin.dashboard.module.css";

const RANGE_KEY = "admin_overview_range";
const RANGE_DAYS: Record<OverviewRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<OverviewRange, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };
const RANGE_OPTIONS = OverviewRangeValues.map((value) => ({
  value,
  label: RANGE_LABELS[value],
  ariaLabel: `Last ${RANGE_LABELS[value]}`,
}));

const readStoredRange = (): OverviewRange => {
  try {
    const stored = window.localStorage.getItem(RANGE_KEY);
    if (stored && (OverviewRangeValues as readonly string[]).includes(stored)) return stored as OverviewRange;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return "7d";
};

const AdminDashboardPage: React.FC = () => {
  const { authState } = useAdminAuth();
  const [range, setRange] = useState<OverviewRange>("7d");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setRange(readStoredRange());
  }, []);

  const enabled = authState.type === "authenticated";
  const { data, isFetching, isError, error, refetch, dataUpdatedAt } = useAdminDashboardOverview(range, enabled);

  useEffect(() => {
    setNow(Date.now());
  }, [dataUpdatedAt]);

  const changeRange = (value: OverviewRange) => {
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
        <Skeleton style={{ height: "2rem", width: "12rem" }} />
        <Skeleton style={{ height: "9rem", width: "100%", borderRadius: "var(--radius-lg)" }} />
        <Skeleton style={{ height: "10rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const { admin } = authState;
  const days = data?.days ?? RANGE_DAYS[range];
  const daily = data?.daily ?? [];

  const totals = data
    ? [
        { value: adminFormat.count(data.totals.teachers), label: "teachers" },
        { value: adminFormat.count(data.totals.students), label: "students" },
        { value: adminFormat.count(data.totals.publishedTests), label: "tests live" },
        { value: adminFormat.count(data.totals.publishedCourses), label: "courses live" },
        { value: adminFormat.count(data.totals.publishedProducts), label: "study notes live" },
        { value: adminFormat.count(data.totals.publishedBundles), label: "bundles live" },
        { value: adminFormat.count(data.totals.activeLiveTests), label: "live tests running" },
        { value: adminFormat.count(data.totals.activeSubscriptions), label: "active subscriptions" },
        { value: adminFormat.count(data.totals.completedOrders), label: "orders, all time" },
        { value: adminFormat.inrCompact(data.totals.lifetimeRevenue), label: "revenue, all time" },
      ]
    : [];

  return (
    <>
      <Helmet>
        <title>Overview - Testkart Admin</title>
        <meta name="description" content="Testkart admin overview." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Overview</h1>
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
            The overview could not be loaded. {error instanceof Error ? error.message : "Try again in a moment."}
          </div>
        )}

        <div className={`${styles.content} ${isFetching && data ? styles.busy : ""}`} aria-busy={isFetching}>
          <AdminAttentionBand attention={data?.attention} permissions={admin.permissions ?? []} isLoading={isFetching} />

          <AdminKpiLedger kpis={data?.kpis} daily={daily} days={days} isLoading={isFetching} />

          <AiConnectorCard audience="admin" />

          <div className={styles.chartRow}>
            <AdminRevenueChart daily={daily} days={days} isLoading={isFetching} />
            <AdminRevenueMix mix={data?.mix ?? []} isLoading={isFetching} />
          </div>

          <div className={styles.tableRow}>
            <AdminTopSellers
              sellers={data?.topSellers ?? []}
              teachers={data?.topTeachers ?? []}
              days={days}
              isLoading={isFetching}
            />
            <AdminRecentOrders orders={data?.recentOrders ?? []} isLoading={isFetching} />
          </div>

          {totals.length > 0 && (
            <footer className={styles.totals} aria-label="Platform totals">
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

export default AdminDashboardPage;
