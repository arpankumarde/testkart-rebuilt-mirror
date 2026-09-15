import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { toProxiedPdfUrl } from '../helpers/pdfProxyUrl';
import { setPdfjsWorkerSrc } from '../helpers/pdfjsWorker';
import styles from './CoursePDFPreview.module.css';

setPdfjsWorkerSrc(pdfjs);

interface CoursePDFPreviewProps {
  url: string;
}

export const CoursePDFPreview: React.FC<CoursePDFPreviewProps> = ({ url }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32);
      }
    };
    
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      clearTimeout(timer);
    };
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  function onDocumentLoadError(err: Error) {
    console.error('Error loading PDF:', err);
    setError('Failed to load the document preview.');
    setIsLoading(false);
  }

  return (
    <div className={styles.pdfContainer} ref={containerRef}>
      {error ? (
        <div className={styles.pdfMessage}>
          <AlertCircle className={styles.pdfErrorIcon} />
          <p>{error}</p>
        </div>
      ) : (
        <div className={styles.pdfDocumentWrapper}>
          {isLoading && (
            <div className={styles.pdfLoadingOverlay}>
              <Loader2 className={styles.pdfSpinner} />
              <p>Loading PDF...</p>
            </div>
          )}
          <Document
            file={toProxiedPdfUrl(url)}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className={styles.pdfDocument}
          >
            {Array.from(new Array(numPages), (_, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={containerWidth || undefined}
                className={styles.pdfPage}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
            ))}
          </Document>
        </div>
      )}
    </div>
  );
};