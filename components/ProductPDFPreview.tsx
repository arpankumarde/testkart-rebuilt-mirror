"use client";

import React from "react";
import { PdfReaderDialog } from "./PdfReaderDialog";
import { useProtectedDocument } from "../helpers/useProtectedDocument";
import type { StudyNoteFileSummary } from "../endpoints/shop/details_GET.schema";

interface ProductPDFPreviewProps {
  product: {
    id: number;
    title: string;
  };
  isOpen: boolean;
  onClose: () => void;
  // The file being previewed. Each file has its own free preview; null shows nothing.
  file: StudyNoteFileSummary | null;
}

const pagesLabel = (count: number) => `${count} ${count === 1 ? "page" : "pages"}`;

// Preview pages arrive as images rendered and marked as a preview on the server, so the PDF itself never
// reaches the browser. The server also stops at the file's own preview limit.
export const ProductPDFPreview: React.FC<ProductPDFPreviewProps> = ({ product, isOpen, onClose, file }) => {
  const previewPages = file?.previewPages ?? 0;
  const { source, totalPages, isLoading, error, refetch } = useProtectedDocument(
    file && previewPages > 0
      ? { type: "notePreview", productId: product.id, ...(file.id > 0 ? { fileId: file.id } : {}) }
      : null,
    isOpen,
  );
  const shownPages = totalPages ?? previewPages;

  let message: string | null = null;
  if (!file || previewPages < 1) {
    message = "This file has no free preview.";
  } else if (error) {
    message = error.message || "The preview could not be loaded. Try again in a moment.";
  }

  const fullPages = file?.pageCount ?? null;
  const note =
    fullPages && fullPages > shownPages
      ? `Free preview - ${shownPages} of ${pagesLabel(fullPages)}`
      : `Free preview - ${pagesLabel(shownPages)}`;

  return (
    <PdfReaderDialog
      // A new reader per file, so switching files starts on page 1 with no pages from the last one.
      key={file ? `${product.id}:${file.id}` : "none"}
      isOpen={isOpen}
      onClose={onClose}
      title={file?.title || product.title}
      note={note}
      source={source}
      loading={isLoading}
      error={message}
      onRetry={file && previewPages > 0 ? refetch : undefined}
      restricted
      endNote={
        <>
          <strong>End of the free preview</strong>
          Purchase this product to access the complete PDF.
        </>
      }
    />
  );
};
