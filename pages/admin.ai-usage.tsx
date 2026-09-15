import React, { useEffect, useMemo, useRef } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "use-debounce";

import { AIUsageStats } from "../components/AIUsageStats";
import { AIUsageByTeacherTable } from "../components/AIUsageByTeacherTable";
import { AIUsageLogsTable } from "../components/AIUsageLogsTable";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { useAIUsageSummary, useAIUsageByTeacher, useAIUsageLogs } from "../helpers/useAdminAIUsage";

import styles from "./admin.ai-usage.module.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const AdminAIUsagePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const teacherPage = parseInt(searchParams.get("teacherPage") || "1", 10);
  const teacherSearchQuery = searchParams.get("teacherSearchQuery") || "";
  const [debouncedTeacherSearch] = useDebounce(teacherSearchQuery, 500);

  const logsPage = parseInt(searchParams.get("logsPage") || "1", 10);
  const statusFilter = searchParams.get("status") || undefined;
  const featureFilter = searchParams.get("feature") || undefined;
  const listFilter = searchParams.get("filter") === "last-7d" ? "last-7d" : "none";

  /* Fixed when the filter is applied, not per render, so the logs query key holds still across renders and refetches. */
  const last7dFrom = useMemo(
    () => (listFilter === "last-7d" ? new Date(Date.now() - WEEK_MS) : undefined),
    [listFilter]
  );

  const summaryQuery = useAIUsageSummary({});

  const byTeacherParams = useMemo(() => ({
    page: teacherPage,
    pageSize: 20,
    searchQuery: debouncedTeacherSearch || undefined,
  }), [teacherPage, debouncedTeacherSearch]);
  const byTeacherQuery = useAIUsageByTeacher(byTeacherParams);

  const logsParams = useMemo(() => ({
    page: logsPage,
    pageSize: 20,
    status: statusFilter as "pending" | "done" | "failed" | undefined,
    feature: featureFilter as "question_generation" | "rewrite" | "generate_all" | undefined,
    dateFrom: last7dFrom,
  }), [logsPage, statusFilter, featureFilter, last7dFrom]);
  const logsQuery = useAIUsageLogs(logsParams);

  const updateParam = (key: string, value: string | undefined, resetPageKey?: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === undefined || value === "") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    if (resetPageKey) {
      newParams.delete(resetPageKey);
    }
    setSearchParams(newParams);
  };

  /* The logs sit below the fold, so a dashboard link scrolls to the notice once the sections above stop changing height. */
  const noticeRef = useRef<HTMLDivElement>(null);
  const scrolledToNotice = useRef(false);
  const sectionsAboveSettled = !summaryQuery.isFetching && !byTeacherQuery.isFetching;
  useEffect(() => {
    if (listFilter === "none" || scrolledToNotice.current || !sectionsAboveSettled) return;
    scrolledToNotice.current = true;
    noticeRef.current?.scrollIntoView({ block: "start" });
  }, [listFilter, sectionsAboveSettled]);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>AI usage - Testkart Admin</title>
      </Helmet>
      <ConsolePageHeader title="AI usage" />

      <AIUsageStats summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

      <AIUsageByTeacherTable
        teachers={byTeacherQuery.data?.teachers}
        isFetching={byTeacherQuery.isFetching}
        error={byTeacherQuery.error}
        searchQuery={teacherSearchQuery}
        onSearchChange={(v) => updateParam("teacherSearchQuery", v, "teacherPage")}
        pagination={byTeacherQuery.data?.pagination}
        currentPage={teacherPage}
        onPageChange={(page) => updateParam("teacherPage", String(page))}
      />

      {listFilter === "last-7d" && (
        <div ref={noticeRef} className={styles.noticeAnchor}>
          <ConsoleFilterNotice
            label={statusFilter === "failed" ? "Failures in the last 7 days" : "Attempts in the last 7 days"}
            count={logsQuery.data?.pagination.total}
            onClear={() => updateParam("filter", undefined, "logsPage")}
            clearLabel="Show all"
          />
        </div>
      )}

      <AIUsageLogsTable
        logs={logsQuery.data?.logs}
        isFetching={logsQuery.isFetching}
        error={logsQuery.error}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => updateParam("status", v, "logsPage")}
        featureFilter={featureFilter}
        onFeatureFilterChange={(v) => updateParam("feature", v, "logsPage")}
        pagination={logsQuery.data?.pagination}
        currentPage={logsPage}
        onPageChange={(page) => updateParam("logsPage", String(page))}
      />
    </div>
  );
};

export default AdminAIUsagePage;
