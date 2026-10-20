import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ListTree } from "lucide-react";
import type { ExtractedHeading } from "../helpers/extractHeadingsWithIds";
import styles from "./HelpArticleToc.module.css";

interface HelpArticleTocProps {
  headings: ExtractedHeading[];
  activeId: string;
  onSelect: (id: string) => void;
  /** "sidebar" is the sticky desktop card; "collapsible" the "On this page" disclosure for narrow screens. */
  variant: "sidebar" | "collapsible";
  /** Heading of the sidebar card. */
  title?: string;
}

/* Heading text comes from the HTML string with tags stripped, so entities
   such as &amp; are still encoded. */
const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export const HelpArticleToc = ({
  headings,
  activeId,
  onSelect,
  variant,
  title = "In this article",
}: HelpArticleTocProps) => {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  // Keeps the active entry in view inside the sidebar card when the list is
  // taller than the card, without scrolling the page.
  useEffect(() => {
    if (variant !== "sidebar" || !activeId) return;
    const scroller = listRef.current?.parentElement;
    const link = listRef.current?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!scroller || !link || scroller.scrollHeight <= scroller.clientHeight) return;
    const top = link.offsetTop - scroller.offsetTop;
    if (top < scroller.scrollTop || top + link.offsetHeight > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 3);
    }
  }, [activeId, variant]);

  const list = (
    <ol ref={listRef} className={styles.list}>
      {headings.map((h) => (
        <li key={h.id} data-level={h.level}>
          <a
            href={`#${h.id}`}
            className={styles.link}
            aria-current={activeId === h.id ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onSelect(h.id);
              if (variant === "collapsible") setOpen(false);
            }}
          >
            {decodeEntities(h.text)}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "collapsible") {
    return (
      <details
        className={styles.collapsible}
        open={open}
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary className={styles.summary}>
          <span className={styles.badge} aria-hidden="true">
            <ListTree size={16} />
          </span>
          <span className={styles.summaryText}>On this page</span>
          <span className={styles.summaryCount}>{headings.length} sections</span>
          <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
        </summary>
        <nav aria-label="On this page" className={styles.collapsibleBody}>
          {list}
        </nav>
      </details>
    );
  }

  return (
    <nav aria-labelledby="help-toc-title" className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.badge} aria-hidden="true">
          <ListTree size={16} />
        </span>
        <h2 id="help-toc-title" className={styles.cardTitle}>
          {title}
        </h2>
      </div>
      <div className={styles.scroller}>{list}</div>
    </nav>
  );
};
