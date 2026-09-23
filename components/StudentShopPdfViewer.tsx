import React from 'react';
import { PdfReaderDialog } from './PdfReaderDialog';
import { useSignedShopPdfUrl } from '../helpers/useSignedShopPdfUrl';

interface StudentShopPdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  fileId?: number | null;
  title: string;
}

/**
 * Opens a purchased study-notes PDF in the shared reader. The reader draws it
 * in-app (canvas rendering, not a native browser PDF plugin), so there is no
 * "Save As" affordance the way a plain <a href download> or <embed> would
 * offer, and the underlying signed URL is short-lived and only ever used
 * inside the reader. The same protection model applies to course PDF lessons
 * - it deters casual downloading but, like any web content, can't fully
 * prevent screenshots.
 */
export const StudentShopPdfViewer: React.FC<StudentShopPdfViewerProps> = ({
  isOpen,
  onClose,
  productId,
  fileId,
  title,
}) => {
  const { signedUrl, isLoading, error, refetch } = useSignedShopPdfUrl({
    productId,
    fileId,
    enabled: isOpen,
  });

  return (
    <PdfReaderDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      note="Read only"
      source={signedUrl ? { kind: 'pdf', url: signedUrl } : null}
      loading={isLoading}
      error={error ? 'This document could not be opened. Try again in a moment.' : null}
      onRetry={refetch}
      restricted
      openInNewTabHref={`/student/shop/${productId}/read${fileId ? `?file=${fileId}` : ''}`}
    />
  );
};
