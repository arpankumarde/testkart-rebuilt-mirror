import React, { useState, Suspense } from "react";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { adminPreviewPath } from "../helpers/useAdminContentPreview";
import { PREVIEW_CONTENT_TYPES, PreviewContentType } from "../endpoints/admin/content-preview/details_GET.schema";
import { Dialog } from "./Dialog";
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from "./ConsoleDialog";
import { Badge } from "./Badge";
import { Separator } from "./Separator";
import { Button } from "./Button";
import {
  ContentReviewAdminView,
  MockTestMeta,
  CourseMeta,
  DigitalProductMeta,
  CourseBundleMeta,
  LiveTestMeta,
} from "../endpoints/admin/content-reviews/list_GET.schema";
import {
  Bot,
  PenLine,
  User,
  Users,
  ShoppingCart,
  Star,
  Tag,
  Globe,
  CalendarDays,
  FileText,
  BookOpen,
  Package,
  Zap,
  BarChart2,
  ExternalLink,
  Clock,
  Trophy,
  Layers,
} from "lucide-react";
import styles from "./ContentReviewDetailDialog.module.css";

const ContentReviewPdfViewer = React.lazy(() => import('./ContentReviewPdfViewer'));

export const reviewPreviewPath = (review: { contentType: string; contentId: number }): string | null =>
  (PREVIEW_CONTENT_TYPES as readonly string[]).includes(review.contentType)
    ? `${adminPreviewPath(review.contentType as PreviewContentType, review.contentId)}?from=reviews`
    : null;

// ─── Formatters ─────────────────────────────────────────────────────────────

const formatNumber = (num: number): string => num.toLocaleString("en-IN");

const formatCurrency = (amount: string | number): string => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const formatFileSize = (bytes: string | number | null): string => {
  if (bytes === null || bytes === undefined) return "N/A";
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (minutes: number | null): string => {
  if (!minutes) return "N/A";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// ─── Status / Type Badge helpers ─────────────────────────────────────────────

const getStatusBadgeVariant = (
  status: string
): "warning" | "success" | "destructive" | "outline" => {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
};

const contentTypeLabel: Record<string, string> = {
  mock_test: "Test series",
  course: "Course",
  digital_product: "Study notes",
  course_bundle: "Bundle",
  live_test: "Live test",
};

// ─── Shared sub-components ───────────────────────────────────────────────────

const GridItem = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) => (
  <div className={styles.gridItem}>
    <span className={styles.gridLabel}>
      {icon}
      {label}
    </span>
    <span className={styles.gridValue}>{value}</span>
  </div>
);

const ThumbnailSection = ({ url, alt }: { url: string; alt: string }) => (
  <div className={styles.thumbnailWrapper}>
    <img src={url} alt={alt} className={styles.thumbnail} />
  </div>
);

// Study notes and newer courses store rich-text HTML; older courses, test series and live tests store plain text.
const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/i;

const DescriptionSection = ({ text }: { text: string }) => {
  if (!HTML_TAG_PATTERN.test(text)) {
    return <p className={styles.description}>{text}</p>;
  }
  return (
    <div
      className={styles.descriptionHtml}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
    />
  );
};

const RatingDisplay = ({
  rating,
  reviewsCount,
}: {
  rating: string | number | null;
  reviewsCount: number;
}) => {
  if (rating === null || rating === undefined) {
    return <span className={styles.muted}>No ratings yet</span>;
  }
  return (
    <span className={styles.ratingGroup}>
      <span>{Number(rating).toFixed(1)}</span>
      <span className={styles.muted}>
        ({formatNumber(reviewsCount)} reviews)
      </span>
    </span>
  );
};

// ─── Content-specific sections ───────────────────────────────────────────────

const MockTestDetails = ({ meta }: { meta: MockTestMeta }) => {
  const total = meta.aiQuestionsCount + meta.manualQuestionsCount;
  const aiPct = total > 0 ? Math.round((meta.aiQuestionsCount / total) * 100) : 0;
  const manualPct = 100 - aiPct;

  return (
    <div className={styles.metaSection}>
      {meta.thumbnailUrl && (
        <ThumbnailSection url={meta.thumbnailUrl} alt="Test thumbnail" />
      )}
      {meta.description && <DescriptionSection text={meta.description} />}

      <div className={styles.grid}>
        <GridItem
          label="Exam"
          value={meta.examName ?? "-"}
          icon={<FileText size={12} />}
        />
        <GridItem
          label="Language"
          value={meta.language ?? "-"}
          icon={<Globe size={12} />}
        />
        <GridItem
          label="Price"
          value={
            meta.isFree ? (
              <Badge variant="secondary">Free</Badge>
            ) : (
              <span className={styles.priceGroup}>
                <span className={styles.pricePrimary}>
                  {formatCurrency(meta.price)}
                </span>
                {meta.discountPrice && (
                  <span className={styles.priceDiscount}>
                    {formatCurrency(meta.discountPrice)}
                  </span>
                )}
              </span>
            )
          }
          icon={<Tag size={12} />}
        />
        <GridItem
          label="Free tests"
          value={formatNumber(meta.freeTestsCount)}
          icon={<BookOpen size={12} />}
        />
        <GridItem
          label="Total tests"
          value={formatNumber(meta.totalTests)}
          icon={<FileText size={12} />}
        />
        <GridItem
          label="Total questions"
          value={formatNumber(meta.totalQuestions)}
          icon={<BarChart2 size={12} />}
        />
        <GridItem
          label="Students enrolled"
          value={formatNumber(meta.studentsEnrolled)}
          icon={<Users size={12} />}
        />
        <GridItem
          label="Completed orders"
          value={formatNumber(meta.totalOrders)}
          icon={<ShoppingCart size={12} />}
        />
        <GridItem
          label="Rating"
          value={
            <RatingDisplay
              rating={meta.rating}
              reviewsCount={meta.reviewsCount}
            />
          }
          icon={<Star size={12} />}
        />
      </div>

      {total > 0 && (
        <div className={styles.breakdownSection}>
          <span className={styles.gridLabel}>Question breakdown</span>
          <div className={styles.breakdownBar}>
            {aiPct > 0 && (
              <div
                className={styles.breakdownBarAi}
                style={{ width: `${aiPct}%` }}
                title={`AI: ${meta.aiQuestionsCount}`}
              />
            )}
            {manualPct > 0 && (
              <div
                className={styles.breakdownBarManual}
                style={{ width: `${manualPct}%` }}
                title={`Manual: ${meta.manualQuestionsCount}`}
              />
            )}
          </div>
          <div className={styles.breakdownLegend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.legendSwatchAi}`} aria-hidden="true" />
              <Bot size={12} />
              AI: {formatNumber(meta.aiQuestionsCount)} ({aiPct}%)
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.legendSwatchManual}`} aria-hidden="true" />
              <PenLine size={12} />
              Manual: {formatNumber(meta.manualQuestionsCount)} ({manualPct}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const DigitalProductDetails = ({
  meta,
  title,
}: {
  meta: DigitalProductMeta;
  title: string;
}) => {
  const [showPdf, setShowPdf] = useState(false);

  return (
    <div className={styles.metaSection}>
      {meta.thumbnailUrl && (
        <ThumbnailSection url={meta.thumbnailUrl} alt="Product thumbnail" />
      )}
      {meta.description && <DescriptionSection text={meta.description} />}

      <div className={styles.grid}>
        <GridItem
          label="Category"
          value={meta.category ?? "-"}
          icon={<Package size={12} />}
        />
        <GridItem
          label="Language"
          value={meta.language ?? "-"}
          icon={<Globe size={12} />}
        />
        <GridItem
          label="Price"
          value={formatCurrency(meta.price)}
          icon={<Tag size={12} />}
        />
        <GridItem
          label="Page count"
          value={meta.pageCount !== null ? formatNumber(meta.pageCount) : "-"}
          icon={<FileText size={12} />}
        />
        <GridItem
          label="File size"
          value={formatFileSize(meta.fileSizeBytes)}
          icon={<BarChart2 size={12} />}
        />
        <GridItem
          label="Preview pages"
          value={meta.previewPages !== null ? formatNumber(meta.previewPages) : "-"}
          icon={<BookOpen size={12} />}
        />
        <GridItem
          label="Total purchases"
          value={formatNumber(meta.totalPurchases)}
          icon={<ShoppingCart size={12} />}
        />
        <GridItem
          label="Rating"
          value={
            <RatingDisplay
              rating={meta.rating}
              reviewsCount={meta.reviewsCount}
            />
          }
          icon={<Star size={12} />}
        />
      </div>

      {meta.pdfUrl && (
        <div className={styles.pdfButtonRow}>
          <Button variant="outline" onClick={() => setShowPdf(true)}>
            <ExternalLink size={15} />
            Preview PDF
          </Button>
        </div>
      )}

      {showPdf && meta.pdfUrl && (
        <Suspense fallback={<div className={styles.pdfLoading}>Loading PDF viewer...</div>}>
          <ContentReviewPdfViewer pdfUrl={meta.pdfUrl} title={title} onClose={() => setShowPdf(false)} />
        </Suspense>
      )}
    </div>
  );
};

const CourseDetails = ({ meta }: { meta: CourseMeta }) => (
  <div className={styles.metaSection}>
    {meta.thumbnailUrl && (
      <ThumbnailSection url={meta.thumbnailUrl} alt="Course thumbnail" />
    )}
    {meta.description && <DescriptionSection text={meta.description} />}

    <div className={styles.grid}>
      <GridItem
        label="Category"
        value={meta.category ?? "-"}
        icon={<Package size={12} />}
      />
      <GridItem
        label="Level"
        value={
          <span className={styles.capitalize}>{meta.level}</span>
        }
        icon={<BarChart2 size={12} />}
      />
      <GridItem
        label="Language"
        value={meta.language ?? "-"}
        icon={<Globe size={12} />}
      />
      <GridItem
        label="Duration"
        value={formatDuration(meta.estimatedDurationMinutes)}
        icon={<Clock size={12} />}
      />
      <GridItem
        label="Price"
        value={formatCurrency(meta.price)}
        icon={<Tag size={12} />}
      />
      <GridItem
        label="Sections"
        value={formatNumber(meta.sectionsCount)}
        icon={<Layers size={12} />}
      />
      <GridItem
        label="Lessons"
        value={formatNumber(meta.lessonsCount)}
        icon={<BookOpen size={12} />}
      />
      <GridItem
        label="Total purchases"
        value={formatNumber(meta.totalPurchases)}
        icon={<ShoppingCart size={12} />}
      />
      <GridItem
        label="Rating"
        value={
          <RatingDisplay
            rating={meta.rating}
            reviewsCount={meta.reviewsCount}
          />
        }
        icon={<Star size={12} />}
      />
    </div>
  </div>
);

const CourseBundleDetails = ({ meta }: { meta: CourseBundleMeta }) => (
  <div className={styles.metaSection}>
    {meta.thumbnailUrl && (
      <ThumbnailSection url={meta.thumbnailUrl} alt="Bundle thumbnail" />
    )}
    {meta.description && <DescriptionSection text={meta.description} />}

    <div className={styles.grid}>
      <GridItem
        label="Price"
        value={formatCurrency(meta.price)}
        icon={<Tag size={12} />}
      />
      <GridItem
        label="Original price"
        value={formatCurrency(meta.originalPrice)}
        icon={<Tag size={12} />}
      />
      {meta.discountPercentage && (
        <GridItem
          label="Discount"
          value={`${Number(meta.discountPercentage).toFixed(0)}%`}
          icon={<Zap size={12} />}
        />
      )}
      <GridItem
        label="Items in bundle"
        value={formatNumber(meta.itemsCount)}
        icon={<Package size={12} />}
      />
    </div>
  </div>
);

const LiveTestDetails = ({ meta }: { meta: LiveTestMeta }) => (
  <div className={styles.metaSection}>
    {meta.thumbnailUrl && (
      <ThumbnailSection url={meta.thumbnailUrl} alt="Live test thumbnail" />
    )}
    {meta.description && <DescriptionSection text={meta.description} />}

    <div className={styles.grid}>
      <GridItem
        label="Start time"
        value={formatDate(meta.startTime)}
        icon={<CalendarDays size={12} />}
      />
      <GridItem
        label="End time"
        value={formatDate(meta.endTime)}
        icon={<CalendarDays size={12} />}
      />
      <GridItem
        label="Max seats"
        value={formatNumber(meta.maxSeats)}
        icon={<Users size={12} />}
      />
      <GridItem
        label="Enrolled"
        value={formatNumber(meta.enrolledCount)}
        icon={<Users size={12} />}
      />
      <GridItem
        label="Entry price"
        value={formatCurrency(meta.price)}
        icon={<Tag size={12} />}
      />
      <GridItem
        label="Prize pool"
        value={formatCurrency(meta.totalPrizePool)}
        icon={<Trophy size={12} />}
      />
      <GridItem
        label="Has prizes"
        value={
          meta.hasPrizes ? (
            <Badge variant="success">Yes</Badge>
          ) : (
            <Badge variant="outline">No</Badge>
          )
        }
        icon={<Trophy size={12} />}
      />
    </div>
  </div>
);

// ─── Shared by the dialog and the split-view pane ─────────────────────────────

export const ContentReviewBadges = ({ review }: { review: ContentReviewAdminView }) => (
  <>
    <Badge variant="outline">
      {contentTypeLabel[review.contentType] ?? review.contentType}
    </Badge>
    <Badge variant={getStatusBadgeVariant(review.status)}>
      {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
    </Badge>
  </>
);

/* The full preview always opens in a new tab so the review queue stays where it was. */
export const ContentReviewOpenButton = ({
  review,
  size = "sm",
  variant = "primary",
}: {
  review: ContentReviewAdminView;
  size?: "sm" | "md";
  variant?: "primary" | "outline";
}) => {
  const previewPath = reviewPreviewPath(review);
  if (!previewPath) return null;
  return (
    <Button variant={variant} size={size} asChild>
      <a href={previewPath} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={14} />
        Open in new tab
      </a>
    </Button>
  );
};

export const ContentReviewDetailBody = ({ review }: { review: ContentReviewAdminView }) => {
  const renderMeta = () => {
    if (!review.contentMeta) {
      return (
        <p className={styles.muted}>
          No additional metadata available for this content item.
        </p>
      );
    }

    const meta = review.contentMeta;

    switch (meta.type) {
      case "mock_test":
        return <MockTestDetails meta={meta} />;
      case "digital_product":
        return (
          <DigitalProductDetails
            meta={meta}
            title={review.contentTitle}
          />
        );
      case "course":
        return <CourseDetails meta={meta} />;
      case "course_bundle":
        return <CourseBundleDetails meta={meta} />;
      case "live_test":
        return <LiveTestDetails meta={meta} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className={styles.grid}>
        <GridItem
          label="Teacher"
          value={
            <span className={styles.stack}>
              <span>{review.teacherName}</span>
              <span className={styles.subValue}>{review.teacherEmail}</span>
            </span>
          }
          icon={<User size={12} />}
        />
        <GridItem
          label="Submitted on"
          value={formatDate(review.createdAt)}
          icon={<CalendarDays size={12} />}
        />
        {review.reviewedAt && (
          <GridItem
            label="Reviewed on"
            value={formatDate(review.reviewedAt)}
            icon={<CalendarDays size={12} />}
          />
        )}
      </div>

      {review.adminNotes && (
        <div
          className={`${styles.adminNotes} ${
            review.status === "rejected" ? styles.adminNotesRejected : ""
          }`}
        >
          <span className={styles.adminNotesLabel}>Admin notes</span>
          <p className={styles.adminNotesText}>{review.adminNotes}</p>
        </div>
      )}

      <Separator />

      {renderMeta()}
    </>
  );
};

// ─── Dialog, used on phones where there is no room for the split view ─────────

interface Props {
  review: ContentReviewAdminView | null;
  onClose: () => void;
  className?: string;
  /* Decision buttons for a pending review, pinned under the details. */
  footer?: React.ReactNode;
}

export const ContentReviewDetailDialog = ({
  review,
  onClose,
  className,
  footer,
}: Props) => {
  const isOpen = review !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ConsoleDialogContent size="xl" className={className} aria-describedby={undefined}>
        <ConsoleDialogHeader title={review?.contentTitle ?? "Content details"}>
          {review && (
            <div className={styles.headerBadgeRow}>
              <ContentReviewBadges review={review} />
              <ContentReviewOpenButton review={review} />
            </div>
          )}
        </ConsoleDialogHeader>

        <ConsoleDialogBody>
          {review && <ContentReviewDetailBody review={review} />}
        </ConsoleDialogBody>
        {footer ? <ConsoleDialogFooter>{footer}</ConsoleDialogFooter> : null}
      </ConsoleDialogContent>
    </Dialog>
  );
};