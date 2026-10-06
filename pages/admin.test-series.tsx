import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useAdminTestSeriesPageQuery, useDeactivateTestMutation } from "../helpers/useAdminTests";
import { AdminTestSeriesPageItem, TestSeriesSortColumn } from "../endpoints/admin/tests/page_GET.schema";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { useServerTableSort, SortOrder } from "../helpers/useTableSort";
import { useListPage } from "../helpers/useListPage";
import { SortableTh } from "../components/SortableTh";
import {
  CheckCircle2,
  XCircle,
  Ban,
  FileText,
  AlertTriangle,
  Users,
  ShoppingCart,
  HelpCircle,
  ListChecks,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { AdminProductDetailPanel } from "../components/AdminProductDetailPanel";
import { adminPreviewPath } from "../helpers/useAdminContentPreview";
import { adminEditPath } from "../helpers/adminContentEdit";
import { AdminEditIconButton } from "../components/AdminEditIconButton";
import styles from "./admin.test-series.module.css";

const STATUS_VALUES = ["all", "published", "unpublished"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

/* Subsets only a dashboard links to. Each mirrors a catalogue dashboard queue's SQL, run on the server. */
const LIST_FILTERS = ["no-tests", "empty-tests"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const FIRST_SORT_ORDER: Record<TestSeriesSortColumn, SortOrder> = {
  title: "asc",
  students: "desc",
  tests: "desc",
  price: "desc",
  createdAt: "desc",
};

const formatNumber = (num: number): string => num.toLocaleString("en-IN");
const formatCount = (num: number, one: string, many: string): string =>
  `${formatNumber(num)} ${num === 1 ? one : many}`;
const formatCurrency = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN")}`;
const formatDate = (date: Date | string | null): string => {
  if (!date) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(date));
};

const getTestUrl = (test: Pick<AdminTestSeriesPageItem, "slug">): string => {
  return `/mock-test/${test.slug}`;
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colStudents} />
    <col className={styles.colCount} />
    <col className={styles.colMoney} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const TestSeriesRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "30%" }} />
      </div>
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "2rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "1.25rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "1.5rem", width: "4rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const TestSeriesCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "12rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "8rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4.25rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const AdminTestSeriesPage: React.FC = () => {
  const deactivateMutation = useDeactivateTestMutation();

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<{ id: number; title: string } | null>(null);
  const [viewingTest, setViewingTest] = useState<AdminTestSeriesPageItem | null>(null);

  const { read, readId, write } = useListUrlParams();
  const statusFilter = read<StatusFilter>("status", STATUS_VALUES, "all");
  const listFilter = read<ListFilter | "none">("filter", LIST_FILTERS, "none");
  const focusId = readId();

  const [searchQuery, setSearchQuery] = useState("");
  const sort = useServerTableSort(FIRST_SORT_ORDER);
  const [page, setPage] = useListPage(
    JSON.stringify([searchQuery, statusFilter, listFilter, focusId, sort.sortBy, sort.sortOrder])
  );

  const { data, isFetching, isPlaceholderData, isError, error, refetch } = useAdminTestSeriesPageQuery({
    page,
    search: searchQuery || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    filter: listFilter === "none" ? undefined : listFilter,
    id: focusId ?? undefined,
    sortBy: sort.sortBy ?? undefined,
    sortOrder: sort.sortBy ? sort.sortOrder : undefined,
  });
  const tests = isPlaceholderData ? undefined : data?.items;

  useRefetchOnLinkArrival(listFilter !== "none" || focusId !== null || statusFilter !== "all", isFetching, refetch);

  const setStatusFilter = (value: string) => write({ status: value === "all" ? null : value });

  /* A linked series opens its panel once; closing it does not bring it back. */
  const openedFocusId = useRef<number | null>(null);
  useEffect(() => {
    if (focusId === null) {
      openedFocusId.current = null;
      return;
    }
    if (!tests || openedFocusId.current === focusId) return;
    const match = tests.find((t) => t.id === focusId);
    if (!match) return;
    openedFocusId.current = focusId;
    setViewingTest(match);
  }, [focusId, tests]);

  const counts = data?.statusCounts;
  const statusTabs = [
    { value: "all", label: "All", count: counts?.all },
    { value: "published", label: "Published", count: counts?.published },
    { value: "unpublished", label: "Unpublished", count: counts?.unpublished },
  ];

  const sortedTests = tests ?? [];
  const matchingCount = tests ? data?.total : undefined;

  const focusedTest = focusId === null ? undefined : tests?.find((t) => t.id === focusId);

  const hasUrlFilter = listFilter !== "none" || focusId !== null;
  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || hasUrlFilter;

  const clearFilters = () => {
    setSearchQuery("");
    write({ status: null, filter: null, id: null });
  };

  /* totalTests is a stored counter that can drift; the dashboard filters count live, so they show the live number. */
  const getTestCount = (test: AdminTestSeriesPageItem) =>
    listFilter === "none" ? test.totalTests : test.liveItemCount;

  const getListFilterLabel = (filter: ListFilter): string => {
    if (filter === "no-tests") return "Published series with no tests inside";
    const label = "Published series with tests that have no questions";
    if (!tests || data?.emptyTestTotal == null) return label;
    return `${label} - ${formatCount(data.emptyTestTotal, "test", "tests")} in ${formatNumber(data.total)} series`;
  };

  const getEmptyCopy = (): { title: string; description: string } => {
    if (focusId !== null && tests && !focusedTest) {
      return {
        title: "This test series is not in the list",
        description: "It may have been removed, or the link is out of date.",
      };
    }
    if (!hasActiveFilters) {
      return { title: "No test series yet", description: "Test series teachers create will be listed here." };
    }
    const onlyListFilter =
      focusId === null && searchQuery === "" && statusFilter === "all";
    if (onlyListFilter && listFilter === "no-tests") {
      return {
        title: "Every published series has tests",
        description: "No published test series is empty.",
      };
    }
    if (onlyListFilter && listFilter === "empty-tests") {
      return {
        title: "Every published test has questions",
        description: "No published test series holds a test without questions.",
      };
    }
    return {
      title: "No test series match these filters",
      description: hasUrlFilter
        ? "Nothing here for this status, search and the filter named above. Clear them to see the rest."
        : "Nothing here for this status and search. Widen the filters to see the rest.",
    };
  };

  const handleDeactivateClick = (testId: number, testTitle: string) => {
    setSelectedTest({ id: testId, title: testTitle });
    setIsDeactivateDialogOpen(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedTest) return;

    try {
      await deactivateMutation.mutateAsync({ testId: selectedTest.id });
      toast.success(`"${selectedTest.title}" is now unpublished.`);
      setIsDeactivateDialogOpen(false);
      setSelectedTest(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Could not unpublish the test series.";
      toast.error(errorMessage);
    }
  };

  /* Published is the usual state, so only an unpublished series carries a flag.
     Under the empty-tests filter each row also flags how many of its tests have no questions. */
  const renderIdentity = (test: AdminTestSeriesPageItem) => (
    <span className={styles.primaryLine}>
      <a
        href={test.isPublished ? getTestUrl(test) : adminPreviewPath("mock_test", test.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.titleLink} ${styles.truncate}`}
        title={test.title}
      >
        {test.title}
      </a>
      {!test.isPublished && (
        <Badge variant="outline" className={styles.flag}>Unpublished</Badge>
      )}
      {listFilter === "empty-tests" && test.emptyTestCount > 0 && (
        <Badge variant="default" className={styles.flag}>
          {formatNumber(test.emptyTestCount)} without questions
        </Badge>
      )}
    </span>
  );

  const renderActions = (test: AdminTestSeriesPageItem) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View details for ${test.title}`}
            onClick={() => setViewingTest(test)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      <AdminEditIconButton type="mock_test" id={test.id} title={test.title} className={styles.iconButton} />
      {test.isPublished && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Unpublish ${test.title}`}
              onClick={() => handleDeactivateClick(test.id, test.title)}
              disabled={
                deactivateMutation.isPending &&
                deactivateMutation.variables?.testId === test.id
              }
            >
              <Ban />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Unpublish</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const renderContent = () => {
    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load the test series"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!tests) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <TestSeriesRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <TestSeriesCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (sortedTests.length === 0) {
      const emptyCopy = getEmptyCopy();
      return (
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        >
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>Show all test series</Button>
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
                <SortableTh column="title" sort={sort}>Test series</SortableTh>
                <SortableTh column="students" sort={sort} className={styles.num}>Students</SortableTh>
                <SortableTh column="tests" sort={sort} className={styles.num}>Tests</SortableTh>
                <SortableTh column="price" sort={sort} className={styles.num}>Price</SortableTh>
                <SortableTh column="createdAt" sort={sort}>Created</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedTests.map((test) => (
                <tr key={test.id}>
                  <td>
                    <div className={styles.stack}>
                      {renderIdentity(test)}
                      <span className={styles.secondaryLine} title={test.teacherName}>{test.teacherName}</span>
                    </div>
                  </td>
                  <td className={`${styles.num} ${test.studentsEnrolled === 0 ? styles.zero : ""}`}>
                    {formatNumber(test.studentsEnrolled)}
                  </td>
                  <td className={`${styles.num} ${getTestCount(test) === 0 ? styles.zero : ""}`}>
                    {formatNumber(getTestCount(test))}
                  </td>
                  <td className={styles.num} title={formatCurrency(test.price)}>
                    {formatCurrency(test.price)}
                  </td>
                  <td className={styles.date}>{formatDate(test.createdAt)}</td>
                  <td>{renderActions(test)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {sortedTests.map((test) => (
            <article key={test.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  {renderIdentity(test)}
                  <span className={styles.secondaryLine} title={test.teacherName}>{test.teacherName}</span>
                </div>
                {renderActions(test)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Students</dt>
                  <dd className={test.studentsEnrolled === 0 ? styles.zero : undefined}>
                    {formatNumber(test.studentsEnrolled)}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Tests</dt>
                  <dd className={getTestCount(test) === 0 ? styles.zero : undefined}>
                    {formatNumber(getTestCount(test))}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Price</dt>
                  <dd>{formatCurrency(test.price)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Created</dt>
                  <dd>{formatDate(test.createdAt)}</dd>
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
        <title>Test series - Testkart Admin</title>
        <meta
          name="description"
          content="Test series across the Testkart platform."
        />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Test series" />

        <ConsoleListToolbar
          tabs={statusTabs}
          value={statusFilter}
          onValueChange={setStatusFilter}
          tabsLabel="Test series status"
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "Search by title or teacher",
            label: "Search test series",
          }}
        />

        {listFilter !== "none" && (
          <ConsoleFilterNotice
            label={getListFilterLabel(listFilter)}
            count={listFilter === "no-tests" ? matchingCount : undefined}
            onClear={() => write({ filter: null })}
            clearLabel="Show all"
          />
        )}
        {focusId !== null && (
          <ConsoleFilterNotice
            label={focusedTest?.title ?? `Test series #${focusId}`}
            count={matchingCount}
            onClear={() => write({ id: null })}
            clearLabel="Show all"
          />
        )}

        <div className={styles.results}>{renderContent()}</div>

        {tests && data && data.totalPages > 1 && (
          <ConsoleListPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        )}

        <ConsoleConfirmDialog
          open={isDeactivateDialogOpen}
          onOpenChange={setIsDeactivateDialogOpen}
          title="Unpublish this test series?"
          description={`"${selectedTest?.title ?? ""}" comes off the site and students can no longer buy it. Anyone already enrolled keeps access.`}
          tone="destructive"
          icon={<Ban size={20} />}
          confirmLabel="Unpublish test series"
          pendingLabel="Unpublishing..."
          isPending={deactivateMutation.isPending}
          onConfirm={handleDeactivateConfirm}
        />

        {viewingTest && (
          <AdminProductDetailPanel
            open={!!viewingTest}
            onOpenChange={(open) => { if (!open) setViewingTest(null); }}
            title={viewingTest.title}
            productTypeLabel="Test series"
            statusBadge={
              viewingTest.isPublished ? (
                <Badge variant="success">
                  <CheckCircle2 size={14} />
                  Published
                </Badge>
              ) : (
                <Badge variant="outline">
                  <XCircle size={14} />
                  Unpublished
                </Badge>
              )
            }
            isLive={viewingTest.isPublished}
            publicUrl={viewingTest.isPublished ? getTestUrl(viewingTest) : null}
            previewUrl={adminPreviewPath("mock_test", viewingTest.id)}
            editUrl={adminEditPath("mock_test", viewingTest.id)}
            teacherName={viewingTest.teacherName}
            price={viewingTest.isFree ? 0 : viewingTest.price}
            createdAt={viewingTest.createdAt}
            stats={[
              { label: "Questions added", value: formatNumber(viewingTest.totalQuestions), icon: <HelpCircle size={18} /> },
              { label: "Tests in series", value: formatNumber(viewingTest.totalTests), icon: <ListChecks size={18} /> },
              { label: "Students enrolled", value: formatNumber(viewingTest.studentsEnrolled), icon: <Users size={18} /> },
              { label: "Completed orders", value: formatNumber(viewingTest.totalOrders), icon: <ShoppingCart size={18} /> },
            ]}
            onUnpublish={
              viewingTest.isPublished
                ? () => {
                    handleDeactivateClick(viewingTest.id, viewingTest.title);
                    setViewingTest(null);
                  }
                : undefined
            }
            isUnpublishing={
              deactivateMutation.isPending &&
              deactivateMutation.variables?.testId === viewingTest.id
            }
          />
        )}
      </div>
    </>
  );
};

export default AdminTestSeriesPage;
