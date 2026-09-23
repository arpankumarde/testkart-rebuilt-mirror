import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toProxiedPdfUrl } from "../helpers/pdfProxyUrl";
import { setPdfjsWorkerSrc } from "../helpers/pdfjsWorker";
import { PdfReaderMessage, PdfReaderSlot, usePdfReader } from "./PdfReaderParts";
import styles from "./PdfReader.module.css";

setPdfjsWorkerSrc(pdfjs);

// The only file that imports react-pdf, so image-only readers (public previews) never download pdf.js.
export default function PdfReaderDocument({ url }: { url: string }) {
  const { numPages, setNumPages, pageWidth, reportRatio } = usePdfReader();
  const [hasFailed, setHasFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (hasFailed) {
    return (
      <PdfReaderMessage
        tone="error"
        onRetry={() => {
          setHasFailed(false);
          setAttempt((current) => current + 1);
        }}
      >
        This document could not be loaded. Check your connection and try again.
      </PdfReaderMessage>
    );
  }

  return (
    <Document
      key={attempt}
      file={toProxiedPdfUrl(url)}
      className={styles.documentRoot}
      onLoadSuccess={({ numPages: total }) => setNumPages(total)}
      onLoadError={(error) => {
        console.error("PDF load error:", error);
        setHasFailed(true);
      }}
      loading={<PdfReaderMessage tone="loading">Loading document...</PdfReaderMessage>}
      error={null}
    >
      {Array.from({ length: numPages }, (_, index) => (
        <PdfReaderSlot key={index + 1} page={index + 1}>
          <Page
            pageNumber={index + 1}
            width={pageWidth}
            renderTextLayer
            renderAnnotationLayer
            loading={null}
            onLoadSuccess={(page) => reportRatio(index + 1, page.height / page.width)}
          />
        </PdfReaderSlot>
      ))}
    </Document>
  );
}
