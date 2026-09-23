import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, Shield } from "lucide-react";
import { Button } from "./Button";
import styles from "./PdfReader.module.css";

export type PdfReaderContextValue = {
  pageWidth: number;
  numPages: number;
  setNumPages: React.Dispatch<React.SetStateAction<number>>;
  ratioOf: (page: number) => number;
  reportRatio: (page: number, ratio: number) => void;
  observe: (element: Element, onChange: (isNear: boolean) => void) => () => void;
};

export const PdfReaderContext = createContext<PdfReaderContextValue | null>(null);

export const usePdfReader = (): PdfReaderContextValue => {
  const value = useContext(PdfReaderContext);
  if (!value) {
    throw new Error("usePdfReader must be used inside a PdfReader");
  }
  return value;
};

// Holds one page's place in the scroll. Its content mounts only while the page is near the viewport, so
// a long document never keeps hundreds of canvases or images alive.
export const PdfReaderSlot: React.FC<{ page: number; children: React.ReactNode }> = ({ page, children }) => {
  const { pageWidth, ratioOf, observe } = usePdfReader();
  const ref = useRef<HTMLDivElement>(null);
  const [isNear, setIsNear] = useState(page <= 2);

  useEffect(() => {
    const element = ref.current;
    return element ? observe(element, setIsNear) : undefined;
  }, [observe]);

  return (
    <div
      ref={ref}
      data-page={page}
      role="group"
      aria-label={`Page ${page}`}
      className={styles.slot}
      style={{ width: pageWidth, height: Math.round(pageWidth * ratioOf(page)) }}
    >
      {isNear ? children : null}
    </div>
  );
};

export const PdfReaderMessage: React.FC<{
  tone: "loading" | "error";
  children: React.ReactNode;
  onRetry?: () => void;
}> = ({ tone, children, onRetry }) => (
  <div className={styles.message} role={tone === "error" ? "alert" : "status"}>
    {tone === "loading" ? (
      <Shield size={36} className={styles.loadingIcon} />
    ) : (
      <AlertCircle size={36} className={styles.errorIcon} />
    )}
    <p>{children}</p>
    {onRetry && (
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);
