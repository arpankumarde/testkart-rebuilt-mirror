"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import { ChevronLeft, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { previewPageQueryOptions, usePreviewPageQuery } from "../helpers/useShopQuery";
import styles from "./ProductPDFPreview.module.css";

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

// Preview pages arrive as images rendered on the server, so the PDF itself never reaches the browser.
export const ProductPDFPreview: React.FC<ProductPDFPreviewProps> = ({
  product,
  isOpen,
  onClose,
  fileId,
  previewTitle,
}) => {
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [imageAttempt, setImageAttempt] = useState<number>(0);

  const maxPreviewPages = product.previewPages ?? 0;
  const hasPreview = maxPreviewPages > 0;

  // Reset state when opening a new product (or a different file within it)
  useEffect(() => {
    if (isOpen) {
      setPageNumber(1);
      setTotalPages(null);
      setFailedImageUrl(null);
    }
  }, [isOpen, product.id, fileId]);

  const {
    data: previewPage,
    isFetching,
    isError,
    refetch,
  } = usePreviewPageQuery(product.id, pageNumber, isOpen && hasPreview, fileId);

  useEffect(() => {
    if (previewPage) {
      setTotalPages(previewPage.totalPages);
    }
  }, [previewPage]);

  // Prepare the next page in the background so Next does not wait on the server.
  useEffect(() => {
    if (!isOpen || !previewPage || previewPage.page >= previewPage.totalPages) return;
    const nextPageQuery = previewPageQueryOptions(product.id, previewPage.page + 1, fileId);
    void queryClient.prefetchQuery(nextPageQuery).then(() => {
      const nextPage = queryClient.getQueryData(nextPageQuery.queryKey);
      if (nextPage) {
        new Image().src = nextPage.imageUrl;
      }
    });
  }, [isOpen, previewPage, product.id, fileId, queryClient]);

  const pageCount = totalPages ?? maxPreviewPages;
  const imageFailed = !!previewPage && failedImageUrl === previewPage.imageUrl;
  const isLoading =
    isFetching || (!!previewPage && !imageFailed && loadedImageUrl !== previewPage.imageUrl);

  const retry = () => {
    setFailedImageUrl(null);
    setImageAttempt((attempt) => attempt + 1);
    if (isError) {
      void refetch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.title}>
            Preview: {previewTitle || product.title}
          </DialogTitle>
          <DialogDescription>
            Showing {pageCount} preview {pageCount === 1 ? "page" : "pages"}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.previewContainer}>
          {!hasPreview ? (
            <div className={styles.messageContainer}>
              <AlertCircle className={styles.icon} />
              <p>No preview pages are available for this document.</p>
            </div>
          ) : isError || imageFailed ? (
            <div className={styles.messageContainer}>
              <AlertCircle className={styles.errorIcon} />
              <p>This preview page could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={retry} className={styles.retryButton}>
                Retry
              </Button>
            </div>
          ) : (
            <div
              className={styles.pageFrame}
              style={
                previewPage
                  ? { aspectRatio: `${previewPage.width} / ${previewPage.height}` }
                  : undefined
              }
            >
              {previewPage && (
                <img
                  key={`${previewPage.imageUrl}-${imageAttempt}`}
                  src={previewPage.imageUrl}
                  width={previewPage.width}
                  height={previewPage.height}
                  alt={`Preview page ${previewPage.page} of ${previewPage.totalPages}`}
                  className={styles.pageImage}
                  draggable={false}
                  onLoad={() => setLoadedImageUrl(previewPage.imageUrl)}
                  onError={() => setFailedImageUrl(previewPage.imageUrl)}
                />
              )}
              {isLoading && (
                <div className={styles.loadingOverlay}>
                  <Loader2 className={styles.spinner} />
                  <p>Loading preview...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {hasPreview && (
          <div className={styles.controls}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((page) => page - 1)}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>

            <span className={styles.pageIndicator}>
              Page {pageNumber} of {pageCount}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((page) => page + 1)}
              disabled={pageNumber >= pageCount}
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