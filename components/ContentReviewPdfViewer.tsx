import React, { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "./Button";
import { Separator } from "./Separator";
import { Skeleton } from "./Skeleton";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  FileText,
} from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toProxiedPdfUrl } from "../helpers/pdfProxyUrl";
import { setPdfjsWorkerSrc } from "../helpers/pdfjsWorker";
import styles from "./ContentReviewPdfViewer.module.css";

setPdfjsWorkerSrc(pdfjs);

export interface ContentReviewPdfViewerProps {
  pdfUrl: string;
  title: string;
  onClose: () => void;
}

export default function ContentReviewPdfViewer({
  pdfUrl,
  title,
  onClose,
}: ContentReviewPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setIsLoading(false);
      console.log(`PDF loaded successfully with ${numPages} pages`);
    },
    []
  );

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("PDF load error:", error);
    setLoadError("Failed to load PDF. The file may be unavailable.");
    setIsLoading(false);
  }, []);

  const goToPrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNextPage = () => setCurrentPage((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(1)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)));

  return (
    <div className={styles.pdfOverlay}>
      <div className={styles.pdfContainer}>
        {/* PDF Toolbar */}
        <div className={styles.pdfToolbar}>
          <span className={styles.pdfTitle}>{title}</span>
          <div className={styles.pdfControls}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className={styles.pdfPageInfo}>
              {currentPage} / {numPages || "—"}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </Button>
            <Separator orientation="vertical" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={zoomOut}
              disabled={scale <= 0.5}
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </Button>
            <span className={styles.pdfZoom}>{Math.round(scale * 100)}%</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={zoomIn}
              disabled={scale >= 2.5}
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </Button>
            <Separator orientation="vertical" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close PDF viewer"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div className={styles.pdfScrollArea}>
          {isLoading && (
            <div className={styles.pdfLoading}>
              <Skeleton
                style={{ width: "600px", height: "800px", maxWidth: "90vw" }}
              />
              <p className={styles.pdfLoadingText}>Loading PDF…</p>
            </div>
          )}
          {loadError && (
            <div className={styles.pdfError}>
              <FileText size={48} className={styles.pdfErrorIcon} />
              <p>{loadError}</p>
            </div>
          )}
          {!loadError && (
            <Document
              file={toProxiedPdfUrl(pdfUrl)}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
            >
              <div className={styles.pdfPageWrapper}>
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer
                  renderAnnotationLayer
                  loading={
                    <Skeleton
                      style={{
                        width: `${Math.round(595 * scale)}px`,
                        height: `${Math.round(842 * scale)}px`,
                        maxWidth: "90vw",
                      }}
                    />
                  }
                />
              </div>
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}