import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, FileText, ChevronRight, Layers, Star } from 'lucide-react';
import { Badge } from './Badge';
import { ReviewDialog } from './ReviewDialog';
import { StudentShopPdfViewer } from './StudentShopPdfViewer';
import { useStudyNoteDownload } from '../helpers/useStudyNoteDownload';
import type { StudentPurchaseItem } from '../endpoints/student/shop/purchases_GET.schema';
import styles from './StudentProductCard.module.css';

interface StudentProductCardProps {
  purchase: StudentPurchaseItem;
  className?: string;
}

export const StudentProductCard: React.FC<StudentProductCardProps> = ({ purchase, className }) => {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const hasMultipleFiles = purchase.fileCount > 1;
  const downloadMutation = useStudyNoteDownload();

  const lastViewed = purchase.lastDownloadedAt
    ? new Date(purchase.lastDownloadedAt).toLocaleDateString()
    : 'Never';

  const statusBadge = purchase.lastDownloadedAt
    ? { label: 'Viewed', variant: 'success' as const, accentVar: 'var(--success)' }
    : { label: 'Not Viewed', variant: 'outline' as const, accentVar: 'var(--border)' };

  return (
    <div
      className={`${styles.card} ${className || ''}`}
      style={{ '--card-accent': statusBadge.accentVar } as React.CSSProperties}
    >
      <div className={styles.cardMain}>
        <div className={styles.iconContainer}>
          {hasMultipleFiles ? (
            <Layers size={24} className={styles.icon} />
          ) : (
            <FileText size={24} className={styles.icon} />
          )}
        </div>

        <div className={styles.content}>
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>{purchase.title}</h3>
              {!purchase.hasReviewed ? (
                <button
                  type="button"
                  className={styles.reviewIconButton}
                  onClick={() => setIsReviewOpen(true)}
                  aria-label="Write a review"
                  title="Write a review"
                >
                  <Star size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.reviewIconButton} ${styles.reviewIconButtonActive}`}
                  onClick={() => setIsReviewOpen(true)}
                  aria-label={`Edit your review (${purchase.reviewRating ?? 0} stars)`}
                  title="Edit your review"
                >
                  <Star size={16} fill="currentColor" />
                </button>
              )}
            </div>
            <div className={styles.categoryRow}>
              <span className={styles.category}>{purchase.category}</span>
              <Badge variant={statusBadge.variant} className={styles.statusBadge}>
                {statusBadge.label}
              </Badge>
              {hasMultipleFiles && (
                <Badge variant="secondary" className={styles.fileCountBadge}>
                  {purchase.fileCount} Files
                </Badge>
              )}
            </div>
          </div>

          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <span className={styles.label}>Teacher:</span>
              <span className={styles.value}>{purchase.teacherName}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.label}>Last Viewed:</span>
              <span className={styles.value}>{lastViewed}</span>
            </div>
          </div>

          {/* Multi-file notes route to a detail page with one row per file;
              single-file notes open the watermarked reader directly. Download
              shows only when the teacher opted this note in (allow_download). */}
          <div className={styles.footer}>
            {hasMultipleFiles ? (
              <Link to={`/student/shop/${purchase.productId}`} className={styles.actionButton}>
                <Layers size={16} />
                View Files
                <ChevronRight size={16} />
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsViewerOpen(true)}
                  className={styles.actionButton}
                >
                  <Eye size={16} />
                  View PDF
                </button>
                {purchase.allowDownload && (
                  <button
                    type="button"
                    onClick={() => downloadMutation.mutate({ productId: purchase.productId })}
                    disabled={downloadMutation.isPending}
                    className={styles.secondaryButton}
                  >
                    <Download size={16} />
                    {downloadMutation.isPending ? 'Preparing...' : 'Download PDF'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!hasMultipleFiles && (
        <StudentShopPdfViewer
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          productId={purchase.productId}
          title={purchase.title}
        />
      )}

      <ReviewDialog
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        digitalProductId={purchase.productId}
        productSlug={purchase.slug}
        testPackageTitle={purchase.title}
        initialRating={purchase.reviewRating}
        initialReviewText={purchase.reviewText}
      />
    </div>
  );
};
