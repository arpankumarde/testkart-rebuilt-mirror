import React from 'react';
import { PdfReaderDialog } from './PdfReaderDialog';
import { useProtectedDocument } from '../helpers/useProtectedDocument';

interface StudentShopPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  fileId?: number | null;
  title: string;
}

/**
 * Opens a purchased study-notes file in the shared reader. Pages arrive as images rendered and watermarked
 * on the server for this student, so the browser never holds the file or a link to it. Like any web
 * content it cannot stop screenshots; the watermark ties them back to the buyer.
 */
export const StudentShopPdfViewer: React.FC<StudentShopPdfViewerProps> = ({
  isOpen,
  onClose,
  productId,
  fileId,
  title,
}) => {
  const { source, isLoading, error, refetch } = useProtectedDocument(
    { type: 'note', productId, ...(fileId ? { fileId } : {}) },
    isOpen,
  );

  return (
    <PdfReaderDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      note="Read only"
      source={source}
      loading={isLoading}
      error={error ? error.message || 'This document could not be opened. Try again in a moment.' : null}
      onRetry={refetch}
      restricted
      openInNewTabHref={`/student/shop/${productId}/read${fileId ? `?file=${fileId}` : ''}`}
    />
  );
};