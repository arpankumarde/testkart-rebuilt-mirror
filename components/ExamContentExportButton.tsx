import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { Printer } from "lucide-react";
import { Button } from "./Button";
import { renderMathInHtml } from "../helpers/renderMathInHtml";
import type { FaqItem } from "../helpers/examContentTypes";
import "katex/dist/katex.min.css";
import styles from "./ExamContentExportButton.module.css";

const ASSET_WAIT_MS = 4000;

interface ExamContentExport {
  examLabel: string;
  sectionLabel: string;
  title: string;
  description: string;
  content: string;
  faqItems: FaqItem[];
}

type ButtonProps = React.ComponentProps<typeof Button>;

interface ExamContentExportButtonProps extends ExamContentExport {
  disabled?: boolean;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

const waitForAssets = (root: HTMLElement): Promise<unknown> => {
  const images = Array.from(root.querySelectorAll("img"), (img) => {
    img.loading = "eager";
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  });
  const timeout = new Promise((resolve) => window.setTimeout(resolve, ASSET_WAIT_MS));
  return Promise.race([Promise.all([...images, document.fonts.ready]), timeout]);
};

const PrintSheet: React.FC<ExamContentExport & { onDone: () => void }> = ({
  examLabel,
  sectionLabel,
  title,
  description,
  content,
  faqItems,
  onDone,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  // One print per mount: the button remounts the sheet with a new key on every click.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    let active = true;
    const root = document.documentElement;
    const previousTitle = document.title;

    root.classList.add(styles.printing);
    window.addEventListener("afterprint", onDone);
    waitForAssets(sheet).then(() => {
      if (!active) return;
      // Browsers name the saved PDF after the document title.
      document.title = title;
      window.print();
    });

    return () => {
      active = false;
      window.removeEventListener("afterprint", onDone);
      root.classList.remove(styles.printing);
      document.title = previousTitle;
    };
  }, []);

  const faqs = faqItems.filter((item) => item.question.trim() || item.answer.trim());
  const exportedOn = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return createPortal(
    <div ref={sheetRef} className={styles.sheet}>
      <header className={styles.header}>
        <span>
          <strong className={styles.brand}>Testkart</strong> · {examLabel}
        </span>
        <span>
          {sectionLabel} · {exportedOn}
        </span>
      </header>
      <h1 className={styles.title}>{title}</h1>
      {description.trim() && <p className={styles.description}>{description}</p>}
      {content.trim() && (
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: renderMathInHtml(sanitizeHtml(content)) }}
        />
      )}
      {faqs.length > 0 && (
        <section className={styles.faqSection}>
          <h2 className={styles.faqHeading}>Frequently Asked Questions</h2>
          {faqs.map((item, index) => (
            <div key={index} className={styles.faqItem}>
              <p className={styles.faqQuestion}>{item.question}</p>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </div>
          ))}
        </section>
      )}
    </div>,
    document.body,
  );
};

export const ExamContentExportButton: React.FC<ExamContentExportButtonProps> = ({
  disabled,
  label = "Export",
  variant = "ghost",
  size = "sm",
  className,
  ...page
}) => {
  const [printJob, setPrintJob] = useState(0);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        onClick={() => setPrintJob((job) => job + 1)}
        title="Print this page or save it as a PDF"
      >
        <Printer size={size === "sm" ? 14 : 18} /> {label}
      </Button>
      {printJob > 0 && <PrintSheet key={printJob} {...page} onDone={() => setPrintJob(0)} />}
    </>
  );
};
