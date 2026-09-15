"use client";

import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ChevronLeft, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { usePreviewUrlQuery } from "../helpers/useShopQuery";
import styles from "./ProductPDFPreview.module.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toProxiedPdfUrl } from "../helpers/pdfProxyUrl";
import { setPdfjsWorkerSrc } from "../helpers/pdfjsWorker";

setPdfjsWorkerSrc(pdfjs);

interface ProductPDFPreviewProps {
  product: {
    id: number;
    title: string;
    previewPages: number | null;
  };
  isOpen: boolean;
  onClose: () => void;
  // When set, previews this specific file within a multi-file product
  // (e.g. one chapter of a study notes set) instead of the product's main
  // file. previewTitle overrides the dialog heading to name that file
  // rather than the whole product.
  fileId?: number | null;
  previewTitle?: string;
}

export const ProductPDFPreview: React.FC<ProductPDFPreviewProps> = ({
  product,
  isOpen,
  onClose,
  fileId,
  previewTitle,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stablePreviewUrl, setStablePreviewUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldFetchPreview = isOpen && (product.previewPages ?? 0) > 0;
  const { data: previewData, isFetching: isFetchingPreviewUrl } = usePreviewUrlQuery(
    product.id,
    shouldFetchPreview,
    fileId
  );

  // Update stable preview URL when data arrives
  useEffect(() => {
    if (isOpen) {
      setStablePreviewUrl(previewData?.previewUrl ?? null);
    } else {
      setStablePreviewUrl(null);
    }
  }, [isOpen, previewData?.previewUrl]);

  // Reset state when opening a new product (or a different file within it)
  useEffect(() => {
    if (isOpen) {
      setPageNumber(1);
      setError(null);
      setIsLoading(true);
    }
  }, [isOpen, product.id, fileId]);

  // Handle responsive width for the PDF page
  useEffect(() => {
    if (!isOpen) return;

    const updateWidth = () => {
      if (containerRef.current) {
        // Subtract padding to prevent overflow
        setContainerWidth(containerRef.current.clientWidth - 32);
      }
    };

    // Initial update
    // Small delay to ensure dialog is rendered and has dimensions
    const timer = setTimeout(updateWidth, 100);

    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
      clearTimeout(timer);
    };
  }, [isOpen]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  function onDocumentLoadError(err: Error) {
    console.error("Error loading PDF:", err);
    setError("Failed to load the document preview.");
    setIsLoading(false);
  }

  const maxPreviewPages = product.previewPages || 0;
  const totalPagesToShow = Math.min(numPages, maxPreviewPages);
  const canGoPrev = pageNumber > 1;
  const canGoNext = pageNumber < totalPagesToShow;

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.title}>
            Preview: {previewTitle || product.title}
          </DialogTitle>
          <DialogDescription>
            Showing {totalPagesToShow > 0 ? totalPagesToShow : 0} preview pages
          </DialogDescription>
        </DialogHeader>

        <div className={styles.previewContainer} ref={containerRef}>
          {isFetchingPreviewUrl ? (
            <div className={styles.loadingOverlay}>
              <Loader2 className={styles.spinner} />
              <p>Loading preview...</p>
            </div>
          ) : !stablePreviewUrl ? (
            <div className={styles.messageContainer}>
              <AlertCircle className={styles.icon} />
              <p>Preview not available for this product.</p>
            </div>
          ) : maxPreviewPages === 0 ? (
            <div className={styles.messageContainer}>
              <AlertCircle className={styles.icon} />
              <p>No preview pages are available for this document.</p>
            </div>
          ) : (
            <>
              {error ? (
                <div className={styles.messageContainer}>
                  <AlertCircle className={styles.errorIcon} />
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setIsLoading(true);
                    }}
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className={styles.documentWrapper}>
                  {isLoading && (
                    <div className={styles.loadingOverlay}>
                      <Loader2 className={styles.spinner} />
                      <p>Loading preview...</p>
                    </div>
                  )}
                  
                  <Document
                    file={toProxiedPdfUrl(stablePreviewUrl)}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className={styles.skeletonWrapper}>
                        <Skeleton className={styles.pageSkeleton} />
                      </div>
                    }
                    className={styles.document}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={containerWidth || undefined}
                      className={styles.page}
                      renderTextLayer={true}
                      renderAnnotationLayer={false}
                      loading={<Skeleton className={styles.pageSkeleton} />}
                    />
                  </Document>
                </div>
              )}
            </>
          )}
        </div>

        {stablePreviewUrl && maxPreviewPages > 0 && !error && (
          <div className={styles.controls}>
            <Button
              variant="outline"
              size="sm"
              onClick={previousPage}
              disabled={!canGoPrev || isLoading}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>

            <span className={styles.pageIndicator}>
              Page {pageNumber} of {totalPagesToShow || "?"}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={!canGoNext || isLoading}
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};