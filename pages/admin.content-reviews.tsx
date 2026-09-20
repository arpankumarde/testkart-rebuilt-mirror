import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import {
  useAdminContentReviewsQuery,
  useReviewContentMutation,
} from "../helpers/useAdminContentReviews";
import { useApproveAllReviews } from "../helpers/useApproveAllReviews";
import { useDebounce } from "../helpers/useDebounce";
import { SortOrder } from "../helpers/useTableSort";
import { SortableTh } from "../components/SortableTh";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { ContentReviewRejectDialog } from "../components/ContentReviewRejectDialog";
import { ContentReviewMetaDisplay } from "../components/ContentReviewMetaDisplay";
import { Link } from "react-router-dom";
import { ContentReviewDetailDialog, reviewPreviewPath } from "../components/ContentReviewDetailDialog";
import {
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
} from "lucide-react";
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

const TEXT_SORTS: ReadonlyArray<ContentReviewSortBy> = ["title", "teacher", "status"];

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type ContentTypeFilter = ContentType | "all";

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

/* Title opens the full admin preview of the submitted item. */
const ReviewTitle = ({ review, className }: { review: ContentReviewAdminView; className: string }) => {
  const path = reviewPreviewPath(review);
  return path ? (
    <Link to={path} className={`${className} ${styles.titleLink}`} title={`Preview ${review.contentTitle}`}>
      {review.contentTitle}
    </Link>
  ) : (
    <span className={className} title={review.contentTitle}>
      {review.contentTitle}
    </span>
  );
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colTeacher} />
    <col className={styles.colStatus} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const RowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="55%" bottom="80%" /></td>
    <td><StackSkeleton top="65%" bottom="85%" /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "4rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const CardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "10rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "8rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "6rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const AdminContentReviewsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { read, write, searchParams } = useListUrlParams();
  const statusFilter = read<StatusFilter>("status", STATUS_VALUES, "pending");
  const contentTypeFilter = read<ContentTypeFilter>("contentType", CONTENT_TYPE_VALUES, "all");
  const [rejectTarget, setRejectTarget] =
    useState<ContentReviewAdminView | null>(null);
  const [viewingReview, setViewingReview] =
    useState<ContentReviewAdminView | null>(null);
  const [approveTarget, setApproveTarget] =
    useState<ContentReviewAdminView | null>(null);
  const [isApproveAllOpen, setIsApproveAllOpen] = useState(false);
  const [sortBy, setSortBy] = useState<ContentReviewSortBy | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const debouncedSearch = useDebounce(searchTerm, 500);

  const setStatusFilter = (value: StatusFilter) => {
    setPage(1);
    write({ status: value === "pending" ? null : value });
  };

  const setContentTypeFilter = (value: ContentTypeFilter) => {
    setPage(1);
    write({ contentType: value === "all" ? null : value });
  };

  const sort = {
    sortBy,
    sortOrder,
    toggleSort: (column: ContentReviewSortBy) => {
      if (column === sortBy) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(column);
        setSortOrder(TEXT_SORTS.includes(column) ? "asc" : "desc");
      }
      setPage(1);
    },
  };

  const filters = {
    status: statusFilter === "all" ? undefined : statusFilter,
    contentType: contentTypeFilter === "all" ? undefined : contentTypeFilter,
    search: debouncedSearch || undefined,
    sortBy: sortBy ?? undefined,
    sortOrder: sortBy ? sortOrder : undefined,
    page,
    limit: 20,
  };

  const { data, isFetching, isError, error, refetch } =
    useAdminContentReviewsQuery(filters);
  useRefetchOnLinkArrival(searchParams.has("status") || contentTypeFilter !== "all", isFetching, refetch);
  const reviewMutation = useReviewContentMutation();
  const approveAllMutation = useApproveAllReviews();

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, contentTypeFilter]);

  const confirmApprove = () => {
    if (!approveTarget) return;
    reviewMutation.mutate(
      { reviewId: approveTarget.id, action: "approve" },
      { onSuccess: () => setApproveTarget(null) }
    );
  };

  const confirmApproveAll = () => {
    approveAllMutation.mutate(undefined, {
      onSuccess: () => setIsApproveAllOpen(false),
    });
  };

  const hasPendingReviews = data?.reviews.some((r) => r.status === "pending") ?? false;
  const showApproveAll = (statusFilter === "pending" || statusFilter === "all") && hasPendingReviews;

  const handleRejectSubmit = (reviewId: number, notes: string) => {
    reviewMutation.mutate(
      { reviewId, action: "reject", adminNotes: notes },
      { onSuccess: () => setRejectTarget(null) }
    );
  };

  const renderStatusFlag = (review: ContentReviewAdminView) => (
    <Badge variant={getStatusBadgeVariant(review.status)} className={styles.flag}>
      {sentenceCase(review.status)}
    </Badge>
  );

  const renderActions = (review: ContentReviewAdminView) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View details of ${review.contentTitle}`}
            onClick={() => setViewingReview(review)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      {review.status === "pending" && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={`${styles.iconButton} ${styles.approveBtn}`}
                aria-label={`Approve ${review.contentTitle}`}
                onClick={() => setApproveTarget(review)}
                disabled={reviewMutation.isPending}
              >
                <CheckCircle />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Approve</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                aria-label={`Reject ${review.contentTitle}`}
                onClick={() => setRejectTarget(review)}
                disabled={reviewMutation.isPending}
              >
                <XCircle />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject</TooltipContent>
          </Tooltip>
        </>
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
                {Array.from({ length: 8 }).map((_, i) => (
                  <RowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </>
      );
    }

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

    if (!data || data.reviews.length === 0) {
      const isFiltered = !!debouncedSearch || statusFilter !== "all" || contentTypeFilter !== "all";
      return (
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title={
            statusFilter === "pending" && !debouncedSearch && contentTypeFilter === "all"
              ? "Nothing waiting on review"
              : isFiltered
              ? "No reviews match these filters"
              : "No content reviews yet"
          }
          description={
            statusFilter === "pending" && !debouncedSearch && contentTypeFilter === "all"
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
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="title" sort={sort}>Content</SortableTh>
                <SortableTh column="teacher" sort={sort}>Teacher</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <SortableTh column="createdAt" sort={sort}>Submitted</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <div className={styles.stack}>
                      <ReviewTitle review={review} className={styles.primaryLine} />
                      <div className={styles.metaLine}>
                        <span className={styles.metaType}>{getTypeLabel(review)}</span>
                        <ContentReviewMetaDisplay meta={review.contentMeta} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine} title={review.teacherName}>{review.teacherName}</span>
                      <span className={styles.secondaryLine} title={review.teacherEmail}>{review.teacherEmail}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      {renderStatusFlag(review)}
                      {review.reviewedAt && (
                        <span
                          className={`${styles.secondaryLine} ${styles.date}`}
                          title={`Reviewed ${formatDate(review.reviewedAt)}`}
                        >
                          {formatDate(review.reviewedAt)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={styles.date}>{formatDate(review.createdAt)}</td>
                  <td>{renderActions(review)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {data.reviews.map((review) => (
            <article key={review.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  <span className={styles.cardTitleLine}>
                    <ReviewTitle review={review} className={styles.truncate} />
                    {renderStatusFlag(review)}
                  </span>
                  <span className={styles.secondaryLine} title={review.teacherName}>{review.teacherName}</span>
                  <span className={styles.secondaryLine} title={review.teacherEmail}>{review.teacherEmail}</span>
                </div>
                {renderActions(review)}
              </div>
              {review.contentMeta && (
                <div className={styles.cardMeta}>
                  <ContentReviewMetaDisplay meta={review.contentMeta} />
                </div>
              )}
              {review.adminNotes && (
                <p className={styles.adminNotes}>Notes: {review.adminNotes}</p>
              )}
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Type</dt>
                  <dd>{getTypeLabel(review)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Submitted</dt>
                  <dd>{formatDate(review.createdAt)}</dd>
                </div>
                {review.reviewedAt && (
                  <div className={styles.cardStat}>
                    <dt>Reviewed</dt>
                    <dd>{formatDate(review.reviewedAt)}</dd>
                  </div>
                )}
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
        <title>Content reviews - Testkart Admin</title>
        <meta
          name="description"
          content="Content submitted by teachers, waiting on approval."
        />
      </Helmet>

      <div className={styles.page}>
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
            onValueChange={(val) =>
              setContentTypeFilter(val as ContentTypeFilter)
            }
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

        <div className={styles.results}>{renderContent()}</div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <ContentReviewRejectDialog
        review={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={handleRejectSubmit}
        isPending={reviewMutation.isPending}
      />

      <ContentReviewDetailDialog
        review={viewingReview}
        onClose={() => setViewingReview(null)}
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
