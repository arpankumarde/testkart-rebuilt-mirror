import React, { useEffect, useRef, useState } from "react";
import styles from "./EmailPreview.module.css";

export type EmailPreviewProps = {
  /** A complete HTML document. Rendered in an iframe so head and body survive. */
  html: string;
  width?: number;
  className?: string;
};

const MIN_HEIGHT = 320;

/**
 * Renders email HTML in an isolated iframe.
 *
 * Every template in email_templates is a full document with a styled <body>.
 * Injecting that with innerHTML drops the doctype, head and body tags and lets
 * the host page's CSS bleed in, so the preview has to be a real document.
 */
export const EmailPreview = ({ html, width, className }: EmailPreviewProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const resize = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const next = Math.max(
        MIN_HEIGHT,
        doc.body.scrollHeight,
        doc.documentElement?.scrollHeight ?? 0
      );
      setHeight(next);
    };

    frame.addEventListener("load", resize);
    // Images finish after load and change the height, so re-measure for a while.
    const timers = [60, 250, 800].map((delay) => setTimeout(resize, delay));

    return () => {
      frame.removeEventListener("load", resize);
      timers.forEach(clearTimeout);
    };
  }, [html, width]);

  return (
    <div className={`${styles.wrapper} ${className || ""}`}>
      <iframe
        ref={frameRef}
        title="Email preview"
        className={styles.frame}
        style={{
          height,
          width: width ? `${width}px` : "100%",
          maxWidth: "100%",
        }}
        srcDoc={html}
        sandbox="allow-same-origin"
      />
    </div>
  );
};
