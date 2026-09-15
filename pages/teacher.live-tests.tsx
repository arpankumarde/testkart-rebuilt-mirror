import React, { useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { Plus, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useTeacherLiveTestsQuery } from "../helpers/useTeacherLiveTestsQuery";
import { useTeacherLiveTestMutations } from "../helpers/useTeacherLiveTestMutations";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { TeacherLiveTestCard } from "../components/TeacherLiveTestCard";
import { LiveTestAnalyticsDialog } from "../components/LiveTestAnalyticsDialog";
import { DuplicateLiveTestDialog } from "../components/DuplicateLiveTestDialog";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
import { TeacherListToolbar } from "../components/TeacherListToolbar";
import { TeacherListEmpty } from "../components/TeacherListEmpty";
import { TeacherListPagination } from "../components/TeacherListPagination";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { Button } from "../components/Button";
import { TestCardSkeleton } from "../components/TestCardSkeleton";
import {
  LiveTestListFilter,
  LiveTestListFilterValues,
} from "../endpoints/teacher/live-tests/list_GET.schema";
import styles from "./teacher.live-tests.module.css";

type StatusTab = "draft" | "live" | "upcoming" | "ended";

const STATUS_TABS: { label: string; value: StatusTab }[] = [
  { label: "Drafts", value: "draft" },
  { label: "Live", value: "live" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Ended", value: "ended" },
];

const STATUS_VALUES = STATUS_TABS.map((tab) => tab.value);
const DEFAULT_STATUS: StatusTab = "draft";
const PAGE_SIZE = 10;

const LIST_FILTERS: Record<LiveTestListFilter, { label: string; empty: string }> = {
  "prizes-pending": {
    label: "Ended live tests with prizes to hand out",
    empty: "No ended live tests with prizes to hand out",
  },
  "starting-soon": {
    label: "Live tests starting in the next 7 days",
    empty: "No live tests starting in the next 7 days",
  },
  active: {
    label: "Active live tests (upcoming or running)",
    empty: "No active live tests",
  },
};

const TeacherLiveTestsPage: React.FC = () => {
  const { read, readId, write } = useListUrlParams();
  const navigate = useNavigate();
  const [analyticsTestId, setAnalyticsTestId] = React.useState<number | null>(null);
  const [duplicatingTestId, setDuplicatingTestId] = React.useState<number | null>(null);
  const page = readId("page") ?? 1;
  const status = read<StatusTab>("status", STATUS_VALUES, DEFAULT_STATUS);
  const listFilter = read<LiveTestListFilter | "none">("filter", LiveTestListFilterValues, "none");
  const filter = listFilter === "none" ? undefined : listFilter;

  const filters = useMemo(
    () => (filter ? { page, filter, limit: PAGE_SIZE } : { page, status, limit: PAGE_SIZE }),
    [page, status, filter]
  );

  const { data, isFetching, error, refetch } = useTeacherLiveTestsQuery(filters);
  useRefetchOnLinkArrival(filter !== undefined, isFetching, refetch);
  const { useDeleteLiveTestMutation, useUnpublishLiveTestMutation } = useTeacherLiveTestMutations();
  const deleteMutation = useDeleteLiveTestMutation();
  const unpublishMutation = useUnpublishLiveTestMutation();

  const activeTabLabel =
    STATUS_TABS.find((tab) => tab.value === status)?.label.toLowerCase() ?? "draft";

  const handleStatusChange = (value: string) => {
    const next = STATUS_VALUES.find((tab) => tab === value) ?? DEFAULT_STATUS;
    write({ status: next === DEFAULT_STATUS ? null : next, filter: null, page: null });
  };

  const handlePageChange = (newPage: number) => {
    write({ page: newPage > 1 ? newPage : null });
  };

  const clearFilter = () => {
    write({ filter: null, page: null });
  };

  const handleEdit = (id: number) => {
    navigate(`/teacher/live-test/${id}/edit`);
  };

  const handleContinueEditing = (id: number) => {
    // Navigate to the dedicated live test question management page
    navigate(`/teacher/live-test/${id}/questions`);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  const handleUnpublish = (id: number) => {
    unpublishMutation.mutate({ id });
  };

  const handleViewAnalytics = (id: number) => {
    const test = data?.tests.find((t) => t.id === id);
    if (test && test.status === "ended") {
      setAnalyticsTestId(id);
    } else {
      toast.info("Analytics are only available for ended tests.");
    }
  };

  const handleDuplicate = (id: number) => {
    setDuplicatingTestId(id);
  };

  const handleDuplicateSuccess = (newId: number) => {
    setDuplicatingTestId(null);
    navigate(`/teacher/live-test/${newId}/questions`);
  };

  const renderContent = () => {
    // Skeletons only on the first load. Swapping the list out on every
    // background refetch made the page flash on each publish or delete.
    if (isFetching && !data) {
      return (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <TestCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <TeacherListEmpty
          tone="error"
          title="Your live tests could not be loaded"
          description="The list did not come back from the server. Check your connection and try again."
        >
          <Button onClick={() => refetch()}>Try again</Button>
        </TeacherListEmpty>
      );
    }

    if (!data || data.tests.length === 0) {
      if (filter) {
        return (
          <TeacherListEmpty
            icon={<CalendarPlus size={26} />}
            title={LIST_FILTERS[filter].empty}
            description="Nothing matches this filter right now. Show all to go back to every live test."
          />
        );
      }

      const isFirstDraftPage = status === DEFAULT_STATUS && page === 1;
      return (
        <TeacherListEmpty
          icon={<CalendarPlus size={26} />}
          title={isFirstDraftPage ? "No live tests yet" : `No ${activeTabLabel} live tests`}
          description={
            isFirstDraftPage
              ? "A live test runs at a scheduled time for everyone at once. Schedule your first one as a draft, then publish it when it is ready."
              : "Nothing here yet. The other tabs may have what you are looking for."
          }
        >
          {isFirstDraftPage && (
            <Button asChild>
              <Link to="/teacher/create-live-test">
                <Plus size={16} />
                Schedule a live test
              </Link>
            </Button>
          )}
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.grid}>
        {data.tests.map((test) => (
          <TeacherLiveTestCard
            key={test.id}
            liveTest={test}
            onEdit={handleEdit}
            onContinueEditing={handleContinueEditing}
            onDelete={handleDelete}
            onViewAnalytics={handleViewAnalytics}
            onDuplicate={handleDuplicate}
            onUnpublish={handleUnpublish}
          />
        ))}
      </div>
    );
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <Helmet>
        <title>Live tests - Testkart for Teachers</title>
        <meta name="description" content="Schedule and manage your live tests on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Live tests">
          <Button asChild>
            <Link to="/teacher/create-live-test">
              <Plus size={16} />
              New live test
            </Link>
          </Button>
        </TeacherPageHeader>

        <TeacherListToolbar
          tabs={STATUS_TABS}
          value={filter ? "" : status}
          onValueChange={handleStatusChange}
          tabsLabel="Filter by status"
        />

        {filter && (
          <ConsoleFilterNotice
            label={LIST_FILTERS[filter].label}
            count={data?.total}
            onClear={clearFilter}
            clearLabel="Show all"
          />
        )}

        <main className={styles.content}>{renderContent()}</main>

        {data && data.total > data.limit && (
          <TeacherListPagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

        <LiveTestAnalyticsDialog
          liveTestId={analyticsTestId}
          liveTestTitle={data?.tests.find((t) => t.id === analyticsTestId)?.title}
          open={!!analyticsTestId}
          onOpenChange={(isOpen) => {
            if (!isOpen) setAnalyticsTestId(null);
          }}
        />

        {duplicatingTestId &&
          data &&
          (() => {
            const testToDuplicate = data.tests.find((t) => t.id === duplicatingTestId);
            return testToDuplicate ? (
              <DuplicateLiveTestDialog
                liveTest={testToDuplicate}
                open={true}
                onOpenChange={(isOpen) => {
                  if (!isOpen) setDuplicatingTestId(null);
                }}
                onSuccess={handleDuplicateSuccess}
              />
            ) : null;
          })()}
      </div>
    </>
  );
};

export default TeacherLiveTestsPage;
