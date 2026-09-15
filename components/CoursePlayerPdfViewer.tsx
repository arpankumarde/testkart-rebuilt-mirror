import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { OutputType as LessonsOutputType } from '../endpoints/student/course/lessons_GET.schema';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { toProxiedPdfUrl } from '../helpers/pdfProxyUrl';
import { setPdfjsWorkerSrc } from '../helpers/pdfjsWorker';
import styles from './CoursePlayerPdfViewer.module.css';

setPdfjsWorkerSrc(pdfjs);

type Lesson = LessonsOutputType['sections'][0]['lessons'][0];

export interface CoursePlayerPdfViewerProps {
  lesson: Lesson;
  signedUrl: string;
  handleContextMenu: (e: React.MouseEvent) => void;
}

export default function CoursePlayerPdfViewer({
  lesson,
  signedUrl,
  handleContextMenu,
}: CoursePlayerPdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isImageFallback, setIsImageFallback] = useState(false);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setIsImageFallback(true);
  };

  return (
    <div className={styles.pdfContainer} onContextMenu={handleContextMenu}>
      <div className={styles.pdfToolbar}>
        <span className={styles.pdfTitle}>{lesson.title}</span>
        {numPages && !isImageFallback && (
          <span className={styles.pageCount}>{numPages} Pages</span>
        )}
      </div>

      <div className={styles.pdfScrollArea}>
        {isImageFallback ? (
          <img
            src={signedUrl}
            alt={lesson.title}
            className={styles.fallbackImage}
          />
        ) : (
          <Document
            file={toProxiedPdfUrl(signedUrl)}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className={styles.pdfLoadingState}>
                <Shield size={48} className={styles.loadingIcon} />
                <p>Loading secure document...</p>
              </div>
            }
            className={styles.pdfDocument}
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <div key={`page_${index + 1}`} className={styles.pdfPageWrapper}>
                <Page
                  pageNumber={index + 1}
                  className={styles.pdfPage}
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                  width={
                    Math.min(
                      800,
                      typeof window !== 'undefined' ? window.innerWidth - 64 : 800
                    )
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
    </div>
  );
}