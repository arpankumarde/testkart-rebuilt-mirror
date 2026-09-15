import React, { useState, useMemo, Suspense, lazy } from "react";
import { SEOHead } from "../components/SEOHead";

import { useSearchParams } from "react-router-dom";
import { Frown, Search } from "lucide-react";
import { useLiveTestsQuery } from "../helpers/useLiveTestsQuery";
import { Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import { InputType as LiveTestFiltersInput } from "../endpoints/live-tests/list_GET.schema";
import styles from "./mock-test.live.module.css";

// Lazy load heavy components
const LiveTestFilters = lazy(() =>
  import("../components/LiveTestFilters").then(m => ({ default: m.LiveTestFilters }))
);
const LiveTestCard = lazy(() =>
  import("../components/LiveTestCard").then(m => ({ default: m.LiveTestCard }))
);

type StatusFilter = LiveTestFiltersInput["status"];

const FiltersSkeleton = () => (
  <div style={{ 
    padding: 'var(--spacing-4)', 
    backgroundColor: 'var(--surface)', 
    borderRadius: 'var(--radius-lg)',
    marginBottom: 'var(--spacing-6)'
  }}>
    <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
      <Skeleton style={{ height: '2.5rem', width: '120px' }} />
      <Skeleton style={{ height: '2.5rem', width: '120px' }} />
      <Skeleton style={{ height: '2.5rem', width: '120px' }} />
    </div>
    <Skeleton style={{ height: '2.5rem', width: '100%' }} />
  </div>
);

const LiveTestsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const status = (searchParams.get("status") || "all") as StatusFilter;
  const searchQuery = searchParams.get("searchQuery") || "";

  const filters = useMemo(
    () => ({
      page,
      status: status === "all" ? undefined : status,
      searchQuery: searchQuery || undefined,
      limit: 12,
    }),
    [page, status, searchQuery]
  );

  const { data, isFetching, error } = useLiveTestsQuery(filters);

  const handleFilterChange = (key: "status" | "searchQuery", value: string) => {
    setSearchParams(
      (prev) => {
        if (key === "status") {
          prev.set("status", value);
        } else if (key === "searchQuery") {
          if (value) {
            prev.set("searchQuery", value);
          } else {
            prev.delete("searchQuery");
          }
        }
        prev.set("page", "1"); // Reset to first page on filter change
        return prev;
      },
      { replace: true }
    );
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(
      (prev) => {
        prev.set("page", newPage.toString());
        return prev;
      },
      { replace: true }
    );
  };

  const renderContent = () => {
    if (isFetching) {
      return Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className={styles.cardSkeleton} />
      ));
    }

    if (error) {
      return (
        <div className={styles.stateContainer}>
          <Frown size={48} />
          <h3>Oops! Something went wrong.</h3>
          <p>We couldn't load the live tests. Please try again later.</p>
        </div>
      );
    }

    if (!data || data.tests.length === 0) {
      return (
        <div className={styles.stateContainer}>
          <Search size={48} />
          <h3>No Live Tests Found</h3>
          <p>
            There are no live tests matching your criteria. Please check back
            later or adjust your filters.
          </p>
        </div>
      );
    }

    return (
      <>
        {data.tests.map((test) => (
          <LiveTestCard key={test.id} liveTest={test} />
        ))}
      </>
    );
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <>
      <SEOHead
        title="Live Mock Tests | Compete in Real-Time"
        description="Join live competitive mock tests, compete with thousands of students in real-time, and win prizes. Check your ranking instantly."
        image="https://assets.floot.app/0a7f01ed-7b95-4c38-9275-16e713383937/54922abf-b666-4d9f-9732-aec0c03c9254.png"
      />
      <div className={styles.pageContainer}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <h1>Live Competitive Tests</h1>
            <p>
              Experience the thrill of real exams. Compete with thousands of
              students in real-time and get instant performance analysis.
            </p>
          </div>
        </header>

        

        <main className={styles.mainContent}>
          <Suspense fallback={<FiltersSkeleton />}>
            <LiveTestFilters
              selectedStatus={status || "all"}
              onStatusChange={(s) => handleFilterChange("status", s)}
              searchQuery={searchQuery}
              onSearchChange={(q) => handleFilterChange("searchQuery", q)}
            />
          </Suspense>

          <div className={styles.grid}>
            <Suspense fallback={Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={styles.cardSkeleton} />
            ))}>
              {renderContent()}
            </Suspense>
          </div>

          {data && data.total > data.limit && (
            <div className={styles.pagination}>
              <Button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                variant="outline"
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default LiveTestsPage;