import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { AlertCircle, Inbox, Mail, RefreshCw, Search } from "lucide-react";
import {
  useAdminThreadQuery,
  useAdminThreadsQuery,
  useRefreshAdminSupport,
} from "../helpers/useAdminSupport";
import { useDebounce } from "../helpers/useDebounce";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { adminFormat } from "../helpers/adminFormat";
import type { AdminSupportThread } from "../endpoints/admin/support/threads_GET.schema";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { AdminSupportThreadList } from "../components/AdminSupportThreadList";
import { AdminSupportConversation } from "../components/AdminSupportConversation";
import styles from "./admin.support.module.css";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

const STATUS_VALUES = ["all", "open", "resolved", "closed"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const LIST_FILTERS = ["unread"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const PAGE_SIZE = 20;

export default function AdminSupportPage() {
  const { read, readId, write } = useListUrlParams();
  const statusFilter = read<StatusFilter>("status", STATUS_VALUES, "all");
  const unreadOnly = read<ListFilter | "none">("filter", LIST_FILTERS, "none") === "unread";
  const selectedId = readId("thread");

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm.trim(), 400);

  // A page number belongs to one set of filters, so a filter change lands on page 1 without fetching the old page first.
  const filterKey = `${statusFilter}|${unreadOnly}|${debouncedSearch}`;
  const [paging, setPaging] = useState({ filterKey, page: 1 });
  const page = paging.filterKey === filterKey ? paging.page : 1;

  const threadsQuery = useAdminThreadsQuery(
    page,
    PAGE_SIZE,
    statusFilter === "all" ? undefined : statusFilter,
    debouncedSearch,
    unreadOnly
  );
  const { data } = threadsQuery;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.limit)) : 1;

  useEffect(() => {
    if (data && !threadsQuery.isPlaceholderData && page > totalPages) setPaging({ filterKey, page: totalPages });
  }, [data, threadsQuery.isPlaceholderData, page, totalPages, filterKey]);

  const listThread = selectedId ? data?.threads.find((thread) => thread.id === selectedId) : undefined;
  const threadQuery = useAdminThreadQuery(selectedId, !!data && !listThread);
  const liveThread = listThread ?? threadQuery.data ?? null;

  // Holds the header steady while a thread that just left the list (resolved under Open, read under Unread) loads on its own.
  const [lastSeen, setLastSeen] = useState<AdminSupportThread | null>(null);
  useEffect(() => {
    if (liveThread) setLastSeen(liveThread);
  }, [liveThread]);
  const selectedThread = liveThread ?? (lastSeen?.id === selectedId ? lastSeen : null);
  const threadUnavailable =
    !!selectedId && !selectedThread && (threadQuery.isError || (threadQuery.isSuccess && threadQuery.data === null));

  const drafts = useRef(new Map<number, string>());

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setNow(Date.now());
  }, [threadsQuery.dataUpdatedAt]);

  const refresh = useRefreshAdminSupport();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refresh(selectedId);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openThread = (id: number) => write({ thread: id });
  const closeThread = () => write({ thread: null });

  const isFiltered = debouncedSearch !== "" || statusFilter !== "all" || unreadOnly;
  const clearFilters = () => {
    setSearchTerm("");
    write({ status: null, filter: null });
  };

  const refreshTitle = threadsQuery.dataUpdatedAt
    ? `Refresh the inbox. Updated ${adminFormat.relativeTime(new Date(threadsQuery.dataUpdatedAt), now)}.`
    : "Refresh the inbox";

  return (
    <>
      <Helmet>
        <title>Support inbox - Testkart Admin</title>
        <meta name="description" content="Support threads from teachers." />
      </Helmet>
      <div className={`${styles.page} ${selectedId ? styles.threadOpen : ""}`}>
        <section className={styles.listPane} aria-labelledby="support-inbox-title">
          <header className={styles.listHeader}>
            <div className={styles.titleRow}>
              <h1 id="support-inbox-title" className={styles.title}>Support inbox</h1>
              <Button
                variant="outline"
                onClick={handleRefresh}
                aria-busy={isRefreshing}
                title={refreshTitle}
                className={styles.refreshButton}
              >
                <RefreshCw className={isRefreshing ? styles.spin : undefined} />
                Refresh
              </Button>
            </div>

            <div className={styles.tabs} role="tablist" aria-label="Thread status">
              {STATUS_TABS.map((tab) => {
                const isActive = statusFilter === tab.value;
                const count = data?.counts?.[tab.value];
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                    onClick={() => write({ status: tab.value === "all" ? null : tab.value })}
                  >
                    {tab.label}
                    {typeof count === "number" && <span className={styles.tabCount}>{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className={styles.filterRow}>
              <div className={styles.search}>
                <Search size={16} className={styles.searchIcon} aria-hidden="true" />
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Name, email or subject"
                  aria-label="Search support threads"
                  className={styles.searchInput}
                />
              </div>
              <button
                type="button"
                className={`${styles.unreadToggle} ${unreadOnly ? styles.unreadToggleOn : ""}`}
                aria-pressed={unreadOnly}
                onClick={() => write({ filter: unreadOnly ? null : "unread" })}
              >
                <Mail size={16} aria-hidden="true" />
                Unread
                {typeof data?.counts?.unread === "number" && (
                  <span className={styles.tabCount}>{data.counts.unread}</span>
                )}
              </button>
            </div>
          </header>

          <AdminSupportThreadList
            threads={data?.threads ?? []}
            hasData={!!data}
            isError={threadsQuery.isError}
            errorMessage={threadsQuery.error instanceof Error ? threadsQuery.error.message : undefined}
            onRetry={() => threadsQuery.refetch()}
            isFiltered={isFiltered}
            onClearFilters={clearFilters}
            showStatus={statusFilter === "all"}
            selectedId={selectedId}
            onSelect={openThread}
            now={now}
            page={page}
            totalPages={totalPages}
            totalCount={data?.totalCount ?? 0}
            onPageChange={(next) => setPaging({ filterKey, page: next })}
            isStale={threadsQuery.isPlaceholderData}
          />
        </section>

        <section className={styles.detailPane} aria-label="Conversation">
          {selectedThread ? (
            <AdminSupportConversation
              key={selectedThread.id}
              thread={selectedThread}
              onBack={closeThread}
              draft={drafts.current.get(selectedThread.id) ?? ""}
              onDraftChange={(text) => {
                if (text) drafts.current.set(selectedThread.id, text);
                else drafts.current.delete(selectedThread.id);
              }}
            />
          ) : threadUnavailable ? (
            <div className={styles.emptyDetail} role="alert">
              <span className={`${styles.emptyIcon} ${styles.emptyIconError}`} aria-hidden="true">
                <AlertCircle size={26} />
              </span>
              <h2 className={styles.emptyTitle}>This thread could not be opened</h2>
              <p className={styles.emptyText}>
                {threadQuery.isError
                  ? "The request did not come back. Refresh to try again."
                  : "No thread has this number. The link may be wrong."}
              </p>
              <Button variant="outline" onClick={closeThread}>Back to all threads</Button>
            </div>
          ) : selectedId ? (
            <div className={styles.detailSkeleton} aria-busy="true">
              <Skeleton style={{ height: "1.25rem", width: "60%" }} />
              <Skeleton style={{ height: "0.875rem", width: "35%" }} />
              <Skeleton style={{ height: "4rem", width: "55%", borderRadius: "var(--radius-lg)" }} />
              <Skeleton style={{ height: "5rem", width: "60%", alignSelf: "flex-end", borderRadius: "var(--radius-lg)" }} />
            </div>
          ) : (
            <div className={styles.emptyDetail}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Inbox size={26} />
              </span>
              <h2 className={styles.emptyTitle}>Choose a thread</h2>
              <p className={styles.emptyText}>Needs reply marks open threads where the teacher wrote last.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}