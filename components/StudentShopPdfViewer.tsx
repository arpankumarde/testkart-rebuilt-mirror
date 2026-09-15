import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog';
import { useSignedShopPdfUrl } from '../helpers/useSignedShopPdfUrl';
import { toProxiedPdfUrl } from '../helpers/pdfProxyUrl';
import { setPdfjsWorkerSrc } from '../helpers/pdfjsWorker';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import styles from './StudentShopPdfViewer.module.css';

setPdfjsWorkerSrc(pdfjs);

interface StudentShopPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  fileId?: number | null;
  title: string;
}

/**
 * Renders a purchased study-notes PDF entirely in-app via react-pdf (canvas
 * rendering, not a native browser PDF plugin), so there's no "Save As"
 * affordance the way a plain <a href download> or <embed> would offer, and
 * the underlying signed URL is short-lived and only ever used inside this
 * viewer. This is the same protection model already used for course PDF
 * lessons (components/CoursePlayerPdfViewer.tsx) — it deters casual
 * downloading but, like any web content, can't fully prevent screenshots.
 */
export const StudentShopPdfViewer: React.FC<StudentShopPdfViewerProps> = ({
  isOpen,
  onClose,
  productId,
  fileId,
  title,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  const { signedUrl, isLoading, error } = useSignedShopPdfUrl({
    productId,
    fileId,
    enabled: isOpen,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.error('Downloading is not allowed — you can read it here anytime.');
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF load error:', err);
    setLoadError(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNumPages(null);
      setLoadError(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader className={styles.header}>
          <DialogTitle className={styles.title}>{title}</DialogTitle>
          <DialogDescription>
            {numPages ? `${numPages} Pages` : 'Read-only — downloading is disabled'}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.pdfScrollArea} onContextMenu={handleContextMenu}>
          {isLoading || (!signedUrl && !error) ? (
            <div className={styles.stateContainer}>
              <Shield size={40} className={styles.loadingIcon} />
              <p>Loading secure document...</p>
            </div>
          ) : error || !signedUrl ? (
            <div className={styles.stateContainer}>
              <AlertCircle size={40} className={styles.errorIcon} />
              <p>Failed to load this document. Please try again later.</p>
            </div>
          ) : loadError ? (
            <div className={styles.stateContainer}>
              <AlertCircle size={40} className={styles.errorIcon} />
              <p>Failed to load the PDF. Please try again later.</p>
            </div>
          ) : (
            <Document
              file={toProxiedPdfUrl(signedUrl)}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className={styles.stateContainer}>
                  <Shield size={40} className={styles.loadingIcon} />
                  <p>Loading secure document...</p>
                </div>
              }
              className={styles.pdfDocument}
            >
              {Array.from(new Array(numPages || 0), (_, index) => (
                <div key={`page_${index + 1}`} className={styles.pdfPageWrapper}>
                  <Page
                    pageNumber={index + 1}
                    className={styles.pdfPage}
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                    width={
                      Math.min(760, typeof window !== 'undefined' ? window.innerWidth - 80 : 760)
                    }
                  />
                  <div className={styles.pageIndicator}>
                    Page {index + 1} of {numPages}
                  </div>
                </div>
              ))}
            </Document>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
