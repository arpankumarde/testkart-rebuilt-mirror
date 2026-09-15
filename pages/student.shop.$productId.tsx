import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Eye, FileText, Layers, Star } from 'lucide-react';
import { useStudentPurchasesQuery } from '../helpers/useShopQuery';
import { useStudentShopFiles } from '../helpers/useStudentShopFiles';
import { ReviewDialog } from '../components/ReviewDialog';
import { StudentShopPdfViewer } from '../components/StudentShopPdfViewer';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import styles from './student.shop.$productId.module.css';

export default function StudentShopProductDetailPage() {
  const { productId: productIdStr } = useParams<{ productId: string }>();
  const productId = productIdStr ? parseInt(productIdStr, 10) : undefined;

  const { data, isFetching, error, refetch } = useStudentPurchasesQuery();
  const purchase = data?.purchases.find((p) => p.productId === productId);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<{ id: number; title: string } | null>(null);

  const { data: filesData, isFetching: isFilesFetching } = useStudentShopFiles(productId);

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  if (isFetching) {
    return (
      <div className={styles.page}>
        <Skeleton className={styles.headerSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Link to="/student/shop" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to study notes
        </Link>
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load this product"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className={styles.page}>
        <Link to="/student/shop" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to study notes
        </Link>
        <ConsoleListEmpty
          icon={<Layers size={24} />}
          title="Could not open this product"
          description="It may have been removed, or it belongs to another account."
        >
          <Button asChild variant="outline">
            <Link to="/student/shop">Go to your study notes</Link>
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const lastViewed = purchase.lastDownloadedAt
    ? new Date(purchase.lastDownloadedAt).toLocaleDateString()
    : 'Not opened yet';

  return (
    <>
      <Helmet>
        <title>{purchase.title} | Study notes | Testkart</title>
        <meta name="description" content={`Read the files in ${purchase.title} inside Testkart.`} />
      </Helmet>
      <div className={styles.page}>
        <Link to="/student/shop" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to study notes
        </Link>

        <div className={styles.headerCard}>
          <div className={styles.cardHeader}>
            <div className={styles.iconContainer}>
              <Layers size={24} />
            </div>
            <div className={styles.headerContent}>
              <span className={styles.category}>{purchase.category}</span>
              <h1 className={styles.title}>{purchase.title}</h1>
              <div className={styles.meta}>
                <span>By {purchase.teacherName}</span>
                <span className={styles.metaDivider} aria-hidden="true">&bull;</span>
                <span>{purchase.fileCount} files</span>
                <span className={styles.metaDivider} aria-hidden="true">&bull;</span>
                <span>Last opened: {lastViewed}</span>
              </div>
            </div>
          </div>

          <div className={styles.headerFooter}>
            <button className={styles.reviewButton} onClick={() => setIsReviewOpen(true)}>
              <Star size={14} fill={purchase.hasReviewed ? 'currentColor' : 'none'} />
              {purchase.hasReviewed ? 'Edit your review' : 'Write a review'}
            </button>
          </div>
        </div>

        {/* Files open read-only inside Testkart's PDF viewer - downloading is
            disabled to protect against piracy, so there is no bulk/individual
            download action here anymore, only View. */}
        <div className={styles.fileList}>
          {isFilesFetching ? (
            <>
              <Skeleton className={styles.itemSkeleton} />
              <Skeleton className={styles.itemSkeleton} />
            </>
          ) : filesData?.files && filesData.files.length > 0 ? (
            filesData.files.map((file) => (
              <div key={file.id} className={styles.fileItem}>
                <div className={styles.fileItemIcon}>
                  <FileText size={18} />
                </div>
                <div className={styles.fileItemInfo}>
                  <span className={styles.fileItemTitle}>{file.title}</span>
                  <div className={styles.fileItemMeta}>
                    {file.pageCount && <span>{file.pageCount} pages</span>}
                    {file.pageCount && file.fileSizeBytes && <span>&bull;</span>}
                    {file.fileSizeBytes && <span>{formatBytes(file.fileSizeBytes)}</span>}
                  </div>
                </div>
                <button
                  className={styles.fileViewButton}
                  onClick={() => setActiveFile({ id: file.id, title: file.title })}
                >
                  <Eye size={16} />
                  Read
                </button>
              </div>
            ))
          ) : (
            <div className={styles.stateBlock}>
              <span className={styles.stateIcon} aria-hidden="true">
                <FileText size={20} />
              </span>
              <h2 className={styles.stateTitle}>No files in this product yet</h2>
              <p className={styles.stateHint}>
                The teacher has not added any files. They will appear here once they do.
              </p>
            </div>
          )}
        </div>

        <StudentShopPdfViewer
          isOpen={!!activeFile}
          onClose={() => setActiveFile(null)}
          productId={purchase.productId}
          fileId={activeFile?.id}
          title={activeFile?.title ?? purchase.title}
        />

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
    </>
  );
}
