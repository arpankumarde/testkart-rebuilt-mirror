import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { useAdminLiveTestsQuery, useDeactivateLiveTestMutation } from "../helpers/useAdminLiveTests";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import {
  Ban,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLiveTestListItem } from "../endpoints/admin/live-tests/list_GET.schema";
import styles from "./admin.live-tests.module.css";

const ALL_TEACHERS = "__all__";

const STATUS_VALUES = ["all", "active", "inactive"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

/* Subsets only a dashboard links to. Each mirrors a catalogue dashboard queue's SQL. */
const LIST_FILTERS = ["prizes-pending", "starts-7d"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const LIST_FILTER_LABELS: Record<ListFilter, string> = {
  "prizes-pending": "Ended live tests with prizes still to distribute",
  "starts-7d": "Live tests starting in the next 7 days",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const timeOf = (date: Date | string | null): number | null => (date ? new Date(date).getTime() : null);

const matchesListFilter = (liveTest: AdminLiveTestListItem, filter: ListFilter | "none", now: number): boolean => {
  if (filter === "prizes-pending") {
    const end = timeOf(liveTest.endTime);
    return liveTest.hasPrizes && liveTest.prizeDistributionStatus === "pending" && end !== null && end < now;
  }
  if (filter === "starts-7d") {
    const start = timeOf(liveTest.startTime);
    return liveTest.isActive && start !== null && start > now && start <= now + WEEK_MS;
  }
  return true;
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colMockTest} />
    <col className={styles.colSchedule} />
    <col className={styles.colSeats} />
    <col className={styles.colMoney} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const LiveTestRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "35%" }} />
      </div>
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "75%" }} />
    </td>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
        <Skeleton style={{ height: "0.75rem", width: "7rem" }} />
      </div>
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "2.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "1.5rem", width: "2rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const LiveTestCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "12rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "8rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "2rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const AdminLiveTestsPage: React.FC = () => {
  const { data: liveTests, isFetching, isError, error, refetch } = useAdminLiveTestsQuery();
  const deactivateMutation = useDeactivateLiveTestMutation();

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [selectedLiveTest, setSelectedLiveTest] = useState<{ id: number; title: string } | null>(null);

  const { read, readId, write } = useListUrlParams();
  const statusFilter = read<StatusFilter>("status", STATUS_VALUES, "all");
  const listFilter = read<ListFilter | "none">("filter", LIST_FILTERS, "none");
  const focusId = readId();

  useRefetchOnLinkArrival(listFilter !== "none" || focusId !== null || statusFilter !== "all", isFetching, refetch);

  const [searchQuery, setSearchQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState(ALL_TEACHERS);

  const setStatusFilter = (value: string) => write({ status: value === "all" ? null : value });

  /* One clock per data load, so rows near a time boundary do not flicker between renders. */
  const now = useMemo(() => Date.now(), [liveTests]);

  const teachers = useMemo(() => {
    if (!liveTests) return [];
    return Array.from(new Set(liveTests.map((t) => t.teacherName))).sort();
  }, [liveTests]);

  const statusTabs = useMemo(() => {
    const all = liveTests ?? [];
    return [
      { value: "all", label: "All", count: all.length },
      { value: "active", label: "Active", count: all.filter((t) => t.isActive).length },
      { value: "inactive", label: "Inactive", count: all.filter((t) => !t.isActive).length },
    ];
  }, [liveTests]);

  const filteredLiveTests = useMemo(() => {
    if (!liveTests) return [];
    const rows = liveTests.filter((liveTest) => {
      const matchesSearch = liveTest.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && liveTest.isActive) ||
        (statusFilter === "inactive" && !liveTest.isActive);
      const matchesTeacher = teacherFilter === ALL_TEACHERS || liveTest.teacherName === teacherFilter;
      const matchesFocus = focusId === null || liveTest.id === focusId;
      return (
        matchesSearch && matchesStatus && matchesTeacher && matchesFocus && matchesListFilter(liveTest, listFilter, now)
      );
    });
    if (listFilter === "starts-7d") {
      rows.sort((a, b) => (timeOf(a.startTime) ?? 0) - (timeOf(b.startTime) ?? 0));
    }
    return rows;
  }, [liveTests, searchQuery, statusFilter, teacherFilter, focusId, listFilter, now]);

  const focusedLiveTest = focusId === null ? undefined : liveTests?.find((t) => t.id === focusId);

  const hasUrlFilter = listFilter !== "none" || focusId !== null;
  const hasActiveFilters =
    searchQuery !== "" || statusFilter !== "all" || teacherFilter !== ALL_TEACHERS || hasUrlFilter;

  const clearFilters = () => {
    setSearchQuery("");
    setTeacherFilter(ALL_TEACHERS);
    write({ status: null, filter: null, id: null });
  };

  const getEmptyCopy = (): { title: string; description: string } => {
    if (focusId !== null && liveTests && !focusedLiveTest) {
      return {
        title: "This live test is not in the list",
        description: "It may have been removed, or the link is out of date.",
      };
    }
    if (!hasActiveFilters) {
      return { title: "No live tests yet", description: "Scheduled live tests will be listed here." };
    }
    const onlyListFilter =
      focusId === null && searchQuery === "" && statusFilter === "all" && teacherFilter === ALL_TEACHERS;
    if (onlyListFilter && listFilter === "prizes-pending") {
      return {
        title: "No prizes waiting to be distributed",
        description: "No ended live test with prizes is still marked pending.",
      };
    }
    if (onlyListFilter && listFilter === "starts-7d") {
      return {
        title: "No live tests starting in the next 7 days",
        description: "No active live test is scheduled to start within a week.",
      };
    }
    return {
      title: "No live tests match these filters",
      description: hasUrlFilter
        ? "Nothing here for this status, teacher, search and the filter named above. Clear them to see the rest."
        : "Nothing here for this status, teacher and search. Widen the filters to see the rest.",
    };
  };

  const formatCurrency = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;
  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Not set';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };

  const formatScheduleTime = (date: Date | string | null): string => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  };

  const getLiveTestUrl = (id: number): string => `/mock-test/live/${id}`;

  const handleDeactivateClick = (liveTestId: number, liveTestTitle: string) => {
    setSelectedLiveTest({ id: liveTestId, title: liveTestTitle });
    setIsDeactivateDialogOpen(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedLiveTest) return;

    try {
      await deactivateMutation.mutateAsync({ liveTestId: selectedLiveTest.id });
      toast.success(`"${selectedLiveTest.title}" is now inactive.`);
      setIsDeactivateDialogOpen(false);
      setSelectedLiveTest(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not deactivate the live test.";
      toast.error(errorMessage);
    }
  };

  const getScheduleTimes = (liveTest: AdminLiveTestListItem) =>
    `${formatScheduleTime(liveTest.startTime)} - ${formatScheduleTime(liveTest.endTime)}`;

  /* Active is the usual state, so only an inactive live test carries a flag. */
  const renderIdentity = (liveTest: AdminLiveTestListItem) => (
    <span className={styles.primaryLine}>
      <a
        href={getLiveTestUrl(liveTest.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.titleLink} ${styles.truncate}`}
        title={liveTest.title}
      >
        {liveTest.title}
      </a>
      {!liveTest.isActive && (
        <Badge variant="outline" className={styles.flag}>Inactive</Badge>
      )}
    </span>
  );

  const renderActions = (liveTest: AdminLiveTestListItem) => (
    <div className={styles.rowActions}>
      {liveTest.isActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Deactivate ${liveTest.title}`}
              onClick={() => handleDeactivateClick(liveTest.id, liveTest.title)}
              disabled={deactivateMutation.isPending && deactivateMutation.variables?.liveTestId === liveTest.id}
            >
              <Ban />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deactivate</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <LiveTestRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <LiveTestCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load the live tests"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (filteredLiveTests.length === 0) {
      const emptyCopy = getEmptyCopy();
      return (
        <ConsoleListEmpty
          icon={<Zap size={24} />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        >
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>Show all live tests</Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <th>Live test</th>
                <th>Mock test</th>
                <th>Schedule</th>
                <th className={styles.num}>Seats</th>
                <th className={styles.num}>Prize pool</th>
                <th>Created</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredLiveTests.map((liveTest) => (
                <tr key={liveTest.id}>
                  <td>
                    <div className={styles.stack}>
                      {renderIdentity(liveTest)}
                      <span className={styles.secondaryLine} title={liveTest.teacherName}>{liveTest.teacherName}</span>
                    </div>
                  </td>
                  <td
                    className={liveTest.mockTestTitle ? undefined : styles.zero}
                    title={liveTest.mockTestTitle || undefined}
                  >
                    {liveTest.mockTestTitle || '-'}
                  </td>
                  <td>
                    <div className={`${styles.stack} ${styles.date}`}>
                      <span className={styles.valueLine}>{formatDate(liveTest.startTime)}</span>
                      <span className={styles.secondaryLine}>{getScheduleTimes(liveTest)}</span>
                    </div>
                  </td>
                  <td className={styles.num}>
                    {liveTest.enrolledCount}/{liveTest.maxSeats}
                  </td>
                  <td className={`${styles.num} ${liveTest.hasPrizes ? "" : styles.zero}`}>
                    {liveTest.hasPrizes ? formatCurrency(liveTest.totalPrizePool) : '-'}
                  </td>
                  <td className={styles.date}>{formatDate(liveTest.createdAt)}</td>
                  <td>{renderActions(liveTest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {filteredLiveTests.map((liveTest) => (
            <article key={liveTest.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  {renderIdentity(liveTest)}
                  <span className={styles.secondaryLine} title={liveTest.teacherName}>{liveTest.teacherName}</span>
                </div>
                {renderActions(liveTest)}
              </div>
              <dl className={styles.cardStats}>
                <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                  <dt>Mock test</dt>
                  <dd className={liveTest.mockTestTitle ? undefined : styles.zero}>
                    {liveTest.mockTestTitle || '-'}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Schedule</dt>
                  <dd>
                    {formatDate(liveTest.startTime)}
                    <span className={styles.cardStatNote}>{getScheduleTimes(liveTest)}</span>
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Seats</dt>
                  <dd>{liveTest.enrolledCount}/{liveTest.maxSeats}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Prize pool</dt>
                  <dd className={liveTest.hasPrizes ? undefined : styles.zero}>
                    {liveTest.hasPrizes ? formatCurrency(liveTest.totalPrizePool) : '-'}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Created</dt>
                  <dd>{formatDate(liveTest.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Live tests - Testkart Admin</title>
        <meta name="description" content="Live tests across the Testkart platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Live tests" />

        <ConsoleListToolbar
          tabs={statusTabs}
          value={statusFilter}
          onValueChange={setStatusFilter}
          tabsLabel="Live test status"
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "Search by title",
            label: "Search live tests",
          }}
        >
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className={consoleToolbarControlClass}>
              <SelectValue placeholder="All teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEACHERS}>All teachers</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher} value={teacher}>{teacher}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        {listFilter !== "none" && (
          <ConsoleFilterNotice
            label={LIST_FILTER_LABELS[listFilter]}
            count={liveTests ? filteredLiveTests.length : undefined}
            onClear={() => write({ filter: null })}
            clearLabel="Show all"
          />
        )}
        {focusId !== null && (
          <ConsoleFilterNotice
            label={focusedLiveTest?.title ?? `Live test #${focusId}`}
            count={liveTests ? filteredLiveTests.length : undefined}
            onClear={() => write({ id: null })}
            clearLabel="Show all"
          />
        )}

        <div className={styles.results}>{renderContent()}</div>

        <ConsoleConfirmDialog
          open={isDeactivateDialogOpen}
          onOpenChange={setIsDeactivateDialogOpen}
          title="Deactivate this live test?"
          description={`"${selectedLiveTest?.title ?? ""}" stops accepting entries and students can no longer take part.`}
          tone="destructive"
          icon={<Ban size={20} />}
          confirmLabel="Deactivate live test"
          pendingLabel="Deactivating..."
          isPending={deactivateMutation.isPending}
          onConfirm={handleDeactivateConfirm}
        />
      </div>
    </>
  );
};

export default AdminLiveTestsPage;
