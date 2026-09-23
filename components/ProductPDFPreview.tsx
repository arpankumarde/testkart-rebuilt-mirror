"use client";

import React, { useMemo } from "react";
import { PdfReaderDialog } from "./PdfReaderDialog";
import type { PdfReaderSource } from "./PdfReader";
import { getShopPreviewPage } from "../endpoints/shop/preview-page_GET.schema";

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
  const pageCount = product.previewPages ?? 0;

  const source = useMemo<PdfReaderSource | null>(
    () =>
      pageCount > 0
        ? {
            kind: "images",
            cacheKey: ["shop", "previewPage", product.id, fileId ?? null],
            pageCount,
            loadPage: (page) =>
              getShopPreviewPage({ productId: product.id, page, fileId: fileId || undefined }),
          }
        : null,
    [pageCount, product.id, fileId],
  );

  return (
    <PdfReaderDialog
      isOpen={isOpen}
      onClose={onClose}
      title={previewTitle || product.title}
      note={`Preview - ${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
      source={source}
      error={source ? null : "No preview pages are available for this document."}
      restricted
    />
  );
};
