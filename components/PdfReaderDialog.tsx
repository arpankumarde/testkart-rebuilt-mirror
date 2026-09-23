import React, { useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "./Dialog";
import { PdfReader, type PdfReaderProps } from "./PdfReader";
import styles from "./PdfReader.module.css";

export interface PdfReaderDialogProps extends Omit<PdfReaderProps, "onClose" | "titleComponent" | "className"> {
  isOpen: boolean;
  onClose: () => void;
}

// The one dialog every PDF and notes preview in the app opens in.
export const PdfReaderDialog: React.FC<PdfReaderDialogProps> = ({ isOpen, onClose, ...readerProps }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={contentRef}
        hideCloseButton
        aria-describedby={undefined}
        className={styles.dialog}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.querySelector<HTMLElement>("[data-pdf-scroll]")?.focus();
        }}
      >
        <PdfReader {...readerProps} onClose={onClose} titleComponent={DialogTitle} className={styles.reader} />
      </DialogContent>
    </Dialog>
  );
};
