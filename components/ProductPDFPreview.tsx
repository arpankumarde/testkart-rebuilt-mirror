"use client";

import React from "react";
import { PdfReaderDialog } from "./PdfReaderDialog";
import { useProtectedDocument } from "../helpers/useProtectedDocument";

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

// Preview pages arrive as images rendered and marked as a preview on the server, so the PDF itself never
// reaches the browser.
export const ProductPDFPreview: React.FC<ProductPDFPreviewProps> = ({
  product,
  isOpen,
  onClose,
  fileId,
  previewTitle,
}) => {
  const previewPages = product.previewPages ?? 0;
  const { source, totalPages, isLoading, error, refetch } = useProtectedDocument(
    previewPages > 0 ? { type: "notePreview", productId: product.id, ...(fileId ? { fileId } : {}) } : null,
    isOpen,
  );
  const pageCount = totalPages ?? previewPages;

  let message: string | null = null;
  if (previewPages < 1) {
    message = "No preview pages are available for this document.";
  } else if (error) {
    message = error.message || "The preview could not be loaded. Try again in a moment.";
  }

  return (
    <PdfReaderDialog
      isOpen={isOpen}
      onClose={onClose}
      title={previewTitle || product.title}
      note={`Preview - ${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
      source={source}
      loading={isLoading}
      error={message}
      onRetry={previewPages > 0 ? refetch : undefined}
      restricted
    />
  );
};