import React from "react";
import { Helmet } from "react-helmet";
import { PdfReader, type PdfReaderProps } from "./PdfReader";
import styles from "./PdfReaderPage.module.css";

// The reader on a page of its own, for the "Open in new tab" links.
export const PdfReaderPage: React.FC<Omit<PdfReaderProps, "onClose" | "titleComponent" | "className">> = (props) => (
  <div className={styles.screen}>
    <Helmet>
      <title>{`${props.title} | Testkart`}</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <PdfReader {...props} />
  </div>
);
