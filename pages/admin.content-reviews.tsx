import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import {
  useAdminContentReviewsQuery,
  useReviewContentMutation,
} from "../helpers/useAdminContentReviews";
import { useApproveAllReviews } from "../helpers/useApproveAllReviews";
import { useDebounce } from "../helpers/useDebounce";
import { useMediaQuery } from "../helpers/useMediaQuery";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { ContentReviewRejectDialog } from "../components/ContentReviewRejectDialog";
import {
  ContentReviewBadges,
  ContentReviewDetailBody,
  ContentReviewDetailDialog,
  ContentReviewOpenButton,
} from "../components/ContentReviewDetailDialog";
import { FileText, CheckCircle, XCircle, AlertCircle, MousePointerClick } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ContentType } from "../helpers/schema";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { ContentReviewAdminView, ContentReviewSortBy } from "../endpoints/admin/content-reviews/list_GET.schema";
import styles from "./admin.content-reviews.module.css";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type ContentTypeFilter = ContentType | "all";
type SortChoice = "newest" | "oldest" | "title" | "teacher";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  mock_test: "Test series",
  course: "Course",
  digital_product: "Study notes",
  course_bundle: "Bundle",
  live_test: "Live test",
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const CONTENT_TYPE_OPTIONS: { value: ContentTypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "mock_test", label: "Test series" },
  { value: "course", label: "Course" },
  { value: "digital_product", label: "Study notes" },
  { value: "course_bundle", label: "Bundle" },
  { value: "live_test", label: "Live test" },
];

const SORT_OPTIONS: { value: SortChoice; label: string; sortBy: ContentReviewSortBy; sortOrder: "asc" | "desc" }[] = [
  { value: "newest", label: "Newest first", sortBy: "createdAt", sortOrder: "desc" },
  { value: "oldest", label: "Oldest first", sortBy: "createdAt", sortOrder: "asc" },
  { value: "title", label: "Title A-Z", sortBy: "title", sortOrder: "asc" },
  { value: "teacher", label: "Teacher A-Z", sortBy: "teacher", sortOrder: "asc" },
];

const STATUS_VALUES = STATUS_OPTIONS.map((opt) => opt.value);
const CONTENT_TYPE_VALUES = CONTENT_TYPE_OPTIONS.map((opt) => opt.value);

const getStatusBadgeVariant = (
  status: string
): "warning" | "success" | "destructive" | "default" => {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "destructive";
    default:
      return "default";
  }
};

const formatDate = (date: Date | null | string): string => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
};

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const getTypeLabel = (review: ContentReviewAdminView) =>
  CONTENT_TYPE_LABELS[review.contentType as ContentType] ?? review.contentType;

const countLabel = (count: number, status: StatusFilter) => {
  if (status === "pending") return `${count} waiting on review`;
  if (status === "all") return `${count} ${count === 1 ? "review" : "reviews"}`;
  return `${count} ${status}`;
};

/* Tablet and up: the queue on the left, the clicked review open on the right. Phones open details in a dialog. */
const SPLIT_QUERY = "(min-width: 768px)";

const QueueSkeleton = () => (
  <ul className={styles.queueList} aria-hidden="true">
    {Array.from({ length: 7 }).map((_, i) => (
      <li key={i} className={styles.rowSkeleton}>
        <Skeleton style={{ height: "0.875rem", width: "85%" }} />
        <Skeleton style={{ height: "0.75rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "35%" }} />
      </li>
    ))}
  </ul>
);

const AdminContentReviewsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { read, write, searchParams } = useListUrlParams();
  const statusFilter = read<StatusFilter>("status", STATUS_VALUES, "pending");
  const contentTypeFilter = read<ContentTypeFilter>("contentType", CONTENT_TYPE_VALUES, "all");
  const [sortChoice, setSortChoice] = useState<SortChoice>("newest");
  const [rejectTarget, setRejectTarget] = useState<ContentReviewAdminView | null>(null);
  const [approveTarget, setApproveTarget] = useState<ContentReviewAdminView | null>(null);
  const [viewingReview, setViewingReview] = useState<ContentReviewAdminView | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isApproveAllOpen, setIsApproveAllOpen] = useState(false);
  const isSplit = useMediaQuery(SPLIT_QUERY);

  const debouncedSearch = useDebounce(searchTerm, 500);
  const sort = SORT_OPTIONS.find((opt) => opt.value === sortChoice) ?? SORT_OPTIONS[0];

  const setStatusFilter = (value: StatusFilter) => {
    setPage(1);
    write({ status: value === "pending" ? null : value });
  };

  const setContentTypeFilter = (value: ContentTypeFilter) => {
    setPage(1);
    write({ contentType: value === "all" ? null : value });
  };

  const filters = {
    status: statusFilter === "all" ? undefined : statusFilter,
    contentType: contentTypeFilter === "all" ? undefined : contentTypeFilter,
    search: debouncedSearch || undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
    page,
    limit: 20,
  };

  const { data, isFetching, isError, error, refetch } = useAdminContentReviewsQuery(filters);
  useRefetchOnLinkArrival(searchParams.has("status") || contentTypeFilter !== "all", isFetching, refetch);
  const reviewMutation = useReviewContentMutation();
  const approveAllMutation = useApproveAllReviews();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, contentTypeFilter, sortChoice]);

  const reviews = data?.reviews ?? [];
  const isInitialLoad = isFetching && !data;

  /* Falls back to the first row when the selection leaves the page. */
  const selectedReview = reviews.find((r) => r.id === selectedId) ?? reviews[0] ?? null;

  /* After a decision the queue moves on to the next review instead of jumping back to the top. */
  const selectNeighbourOf = (review: ContentReviewAdminView) => {
    const index = reviews.findIndex((r) => r.id === review.id);
    const neighbour = reviews[index + 1] ?? reviews[index - 1] ?? null;
    setSelectedId(neighbour?.id ?? null);
  };

  const confirmApprove = () => {
    if (!approveTarget) return;
    const target = approveTarget;
    reviewMutation.mutate(
      { reviewId: target.id, action: "approve" },
      {
        onSuccess: () => {
          setApproveTarget(null);
          setViewingReview(null);
          if (statusFilter === "pending") selectNeighbourOf(target);
        },
      }
    );
  };

  const handleRejectSubmit = (reviewId: number, notes: string) => {
    const target = reviews.find((r) => r.id === reviewId);
    reviewMutation.mutate(
      { reviewId, action: "reject", adminNotes: notes },
      {
        onSuccess: () => {
          setRejectTarget(null);
          setViewingReview(null);
          if (target && statusFilter === "pending") selectNeighbourOf(target);
        },
      }
    );
  };

  const confirmApproveAll = () => {
    approveAllMutation.mutate(undefined, {
      onSuccess: () => setIsApproveAllOpen(false),
    });
  };

  const hasPendingReviews = reviews.some((r) => r.status === "pending");
  const showApproveAll = (statusFilter === "pending" || statusFilter === "all") && hasPendingReviews;

  const openReview = (review: ContentReviewAdminView) => {
    if (isSplit) setSelectedId(review.id);
    else setViewingReview(review);
  };

  /* Up and down arrows walk the queue; in the split view the pane follows. */
  const handleQueueKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-review-row]"));
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    event.preventDefault();
    const next = rows[Math.min(rows.length - 1, Math.max(0, current + (event.key === "ArrowDown" ? 1 : -1)))];
    next.focus();
    if (isSplit) next.click();
  };

  const renderDecision = (review: ContentReviewAdminView) => (
    <div className={styles.decisionActions}>
      <Button
        variant="outline"
        className={styles.rejectBtn}
        onClick={() => setRejectTarget(review)}
        disabled={reviewMutation.isPending}
      >
        <XCircle size={16} />
        Reject
      </Button>
      <Button
        variant="primary"
        onClick={() => setApproveTarget(review)}
        disabled={reviewMutation.isPending}
      >
        <CheckCircle size={16} />
        Approve
      </Button>
    </div>
  );

  const renderEmpty = () => {
    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the reviews"
          description={
            error instanceof Error
              ? error.message
              : "The request did not come back. Check your connection and try again."
          }
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    const isFiltered = !!debouncedSearch || statusFilter !== "all" || contentTypeFilter !== "all";
    const isCleanPending = statusFilter === "pending" && !debouncedSearch && contentTypeFilter === "all";
    return (
      <ConsoleListEmpty
        icon={<FileText size={24} />}
        title={
          isCleanPending
            ? "Nothing waiting on review"
            : isFiltered
            ? "No reviews match these filters"
            : "No content reviews yet"
        }
        description={
          isCleanPending
            ? "Everything teachers have submitted has been looked at."
            : isFiltered
            ? "Nothing here for this status, type and search. Widen the filters to see the rest."
            : "Content teachers submit for approval appears here."
        }
      >
        {isFiltered && (
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setPage(1);
              write({ status: "all", contentType: null });
            }}
          >
            Show all reviews
          </Button>
        )}
      </ConsoleListEmpty>
    );
  };

  const renderQueue = () => (
    <section className={styles.queue} aria-label="Review queue">
      <div className={styles.queueHead}>
        <span className={styles.queueCount} aria-live="polite">
          {data ? countLabel(data.totalCount, statusFilter) : "Loading reviews"}
          {isFetching && data ? <span className={styles.updating}>Updating</span> : null}
        </span>
        <Select value={sortChoice} onValueChange={(val) => setSortChoice(val as SortChoice)}>
          <SelectTrigger className={styles.sortTrigger} aria-label="Sort reviews">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={styles.queueScroll}>
        {isInitialLoad ? (
          <QueueSkeleton />
        ) : (
          <ul className={styles.queueList} onKeyDown={handleQueueKeyDown}>
            {reviews.map((review) => {
              const isSelected = isSplit && review.id === selectedReview?.id;
              return (
                <li key={review.id}>
                  <button
                    type="button"
                    data-review-row
                    className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => openReview(review)}
                  >
                    <span className={styles.rowTitle} title={review.contentTitle}>
                      {review.contentTitle}
                    </span>
                    <span className={styles.rowMeta}>
                      <span className={styles.rowType}>{getTypeLabel(review)}</span>
                      <span className={styles.rowTeacher} title={review.teacherName}>
                        {review.teacherName}
                      </span>
                      <span className={styles.rowDate}>{formatDate(review.createdAt)}</span>
                      {statusFilter === "all" && (
                        <Badge variant={getStatusBadgeVariant(review.status)} className={styles.flag}>
                          {sentenceCase(review.status)}
                        </Badge>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <ConsoleListPagination
          page={data.currentPage}
          totalPages={data.totalPages}
          onPageChange={setPage}
          className={styles.queuePagination}
        />
      )}
    </section>
  );

  const renderPane = () => {
    if (!selectedReview) {
      return (
        <section className={styles.pane} aria-label="Review details">
          <div className={styles.paneIdle}>
            <MousePointerClick size={20} aria-hidden="true" />
            <p>{isInitialLoad ? "Loading reviews..." : "Pick a review on the left to open it here."}</p>
          </div>
        </section>
      );
    }
    return (
      <section className={styles.pane} aria-label="Review details">
        <header className={styles.paneHeader}>
          <div className={styles.paneHeading}>
            <h2 className={styles.paneTitle}>{selectedReview.contentTitle}</h2>
            <div className={styles.paneBadges}>
              <ContentReviewBadges review={selectedReview} />
            </div>
          </div>
          <ContentReviewOpenButton review={selectedReview} variant="outline" />
        </header>

        <div className={styles.paneBody} key={selectedReview.id}>
          <ContentReviewDetailBody review={selectedReview} />
        </div>

        {selectedReview.status === "pending" && (
          <footer className={styles.decisionBar}>
            <p className={styles.decisionHint}>
              Approve puts it live for students. Reject sends the teacher your notes.
            </p>
            {renderDecision(selectedReview)}
          </footer>
        )}
      </section>
    );
  };

  const hasRows = reviews.length > 0 || isInitialLoad;

  return (
    <>
      <Helmet>
        <title>Content reviews - Testkart Admin</title>
        <meta
          name="description"
          content="Content submitted by teachers, waiting on approval."
        />
      </Helmet>

      <div className={`${styles.page} ${isSplit ? styles.pageSplit : ""}`}>
        <ConsolePageHeader title="Content reviews">
          {showApproveAll && (
            <Button
              variant="outline"
              className={styles.approveAllBtn}
              onClick={() => setIsApproveAllOpen(true)}
              disabled={approveAllMutation.isPending}
            >
              <CheckCircle size={16} />
              Approve all pending
            </Button>
          )}
        </ConsolePageHeader>

        <ConsoleListToolbar
          tabs={STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as StatusFilter)}
          tabsLabel="Review status"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by title",
            label: "Search content reviews",
          }}
        >
          <Select
            value={contentTypeFilter}
            onValueChange={(val) => setContentTypeFilter(val as ContentTypeFilter)}
          >
            <SelectTrigger className={consoleToolbarControlClass}>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        {hasRows && !isError ? (
          <div className={styles.workspace}>
            {renderQueue()}
            {isSplit && renderPane()}
          </div>
        ) : (
          renderEmpty()
        )}
      </div>

      <ContentReviewRejectDialog
        review={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={handleRejectSubmit}
        isPending={reviewMutation.isPending}
      />

      <ContentReviewDetailDialog
        review={isSplit ? null : viewingReview}
        onClose={() => setViewingReview(null)}
        footer={viewingReview?.status === "pending" ? renderDecision(viewingReview) : undefined}
      />

      <ConsoleConfirmDialog
        open={!!approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        icon={<CheckCircle size={20} />}
        title="Approve this content?"
        description={
          approveTarget
            ? `"${approveTarget.contentTitle}" by ${approveTarget.teacherName} goes live on the site and students can buy it.`
            : undefined
        }
        confirmLabel="Approve"
        pendingLabel="Approving..."
        isPending={reviewMutation.isPending}
        onConfirm={confirmApprove}
      />

      <ConsoleConfirmDialog
        open={isApproveAllOpen}
        onOpenChange={setIsApproveAllOpen}
        icon={<CheckCircle size={20} />}
        title="Approve everything pending?"
        description="Every item waiting on review goes live at once, including ones further down this list. There is no undo - each would have to be taken down one at a time."
        confirmLabel="Approve all"
        pendingLabel="Approving..."
        isPending={approveAllMutation.isPending}
        onConfirm={confirmApproveAll}
      />
    </>
  );
};

export default AdminContentReviewsPage;
