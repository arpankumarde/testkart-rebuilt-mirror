import React, { useMemo, useRef } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { CalendarDays, FileText, ReceiptText, ShieldCheck, type LucideIcon } from "lucide-react";
import { useStaticPageQuery } from "../helpers/useStaticPages";
import { wrapContentTables } from "../helpers/contentTables";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { extractHeadingsWithIds, type ExtractedHeading } from "../helpers/extractHeadingsWithIds";
import { useHeadingScrollSpy } from "../helpers/useHeadingScrollSpy";
import { Skeleton } from "./Skeleton";
import { HelpArticleToc } from "./HelpArticleToc";
import styles from "./LegalPage.module.css";

export type LegalSlug = "terms" | "privacy" | "refund";

interface PolicyMeta {
  path: string;
  label: string;
  fallbackTitle: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
  icon: LucideIcon;
  tone: "lavender" | "sage" | "peach";
}

const POLICIES: Record<LegalSlug, PolicyMeta> = {
  terms: {
    path: "/terms",
    label: "Terms & Conditions",
    fallbackTitle: "Terms & Conditions",
    intro: "The terms that apply when you use the Testkart website, app and learning products.",
    seoTitle: "Terms & Conditions - Testkart",
    seoDescription: "Read the Terms and Conditions for using the Testkart platform. Understand your rights and responsibilities as a user.",
    icon: FileText,
    tone: "lavender",
  },
  privacy: {
    path: "/privacy",
    label: "Privacy Policy",
    fallbackTitle: "Privacy Policy",
    intro: "How Testkart collects, uses, shares and protects your personal data, and the rights you have over it.",
    seoTitle: "Privacy Policy - Testkart",
    seoDescription: "Read the Privacy Policy for Testkart. Learn how we collect, use, and protect your personal information.",
    icon: ShieldCheck,
    tone: "sage",
  },
  refund: {
    path: "/refund",
    label: "Refund Policy",
    fallbackTitle: "Refund Policy",
    intro: "When refunds apply to purchases made on Testkart, and how they are handled.",
    seoTitle: "Refund Policy - Testkart",
    seoDescription: "Read the Refund Policy for Testkart. Understand the terms and conditions for refunds on our platform.",
    icon: ReceiptText,
    tone: "peach",
  },
};

const POLICY_ORDER: LegalSlug[] = ["terms", "privacy", "refund"];

/** Fewer sections than this and the page is short enough to read without a TOC. */
const MIN_TOC_SECTIONS = 3;

/* A policy whose content opens with a bold "Version 2.0 - effective from ..."
   paragraph shows that line, verbatim, in the header instead of as the first
   body paragraph. Anything else stays in the body untouched. */
const VERSION_LINE = /^\s*<p>\s*<strong>\s*(Version\s[^<]{1,80}?)\s*<\/strong>\s*<\/p>/i;

const formatDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));

/**
 * Shared layout for /terms, /privacy and /refund. The legal text comes from
 * the admin-edited static_pages row for the slug and is rendered as stored
 * (sanitised, headings given stable ids, tables wrapped); this component
 * only adds the header, policy switcher and table of contents around it.
 */
export const LegalPage = ({ slug }: { slug: LegalSlug }) => {
  const policy = POLICIES[slug];
  const Icon = policy.icon;
  const { data: page, isFetching, error } = useStaticPageQuery(slug);
  const contentRef = useRef<HTMLDivElement>(null);

  const { markup, headings, versionLine } = useMemo(() => {
    if (!page?.content) return { markup: { __html: "" }, headings: [] as ExtractedHeading[], versionLine: null };
    let html = sanitizeHtml(page.content);
    const match = html.match(VERSION_LINE);
    if (match) html = html.slice(match[0].length);
    const extracted = extractHeadingsWithIds(html);
    // One stable object: React re-applies innerHTML whenever this prop's
    // identity changes, which would drop focus moved into the content.
    return {
      markup: { __html: wrapContentTables(extracted.html) },
      headings: extracted.headings,
      versionLine: match ? match[1].trim() : null,
    };
  }, [page?.content]);

  const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);
  const { activeId, scrollTo } = useHeadingScrollSpy(contentRef, headingIds);
  const hasToc = headings.filter((h) => h.level === 2).length >= MIN_TOC_SECTIONS;

  const title = page?.title || policy.fallbackTitle;

  return (
    <>
      <Helmet>
        <title>{policy.seoTitle}</title>
        <meta name="description" content={policy.seoDescription} />
        <link rel="canonical" href={`https://testkart.in${policy.path}`} />
      </Helmet>

      <div className={`${styles.pageWrapper} ${styles[policy.tone]}`}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <nav aria-label="Legal policies" className={styles.policyNav}>
              {POLICY_ORDER.map((key) => (
                <Link
                  key={key}
                  to={POLICIES[key].path}
                  className={styles.policyLink}
                  aria-current={key === slug ? "page" : undefined}
                >
                  {POLICIES[key].label}
                </Link>
              ))}
            </nav>

            <div className={styles.titleRow}>
              <span className={styles.iconTile} aria-hidden="true">
                <Icon size={26} />
              </span>
              <div className={styles.titleText}>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.intro}>{policy.intro}</p>
              </div>
            </div>

            {page && (versionLine || page.updatedAt) && (
              <div className={styles.metaRow}>
                {versionLine && <span className={`${styles.metaChip} ${styles.metaVersion}`}>{versionLine}</span>}
                {page.updatedAt && (
                  <span className={styles.metaChip}>
                    <CalendarDays size={14} aria-hidden="true" />
                    Last updated{" "}
                    <time dateTime={new Date(page.updatedAt).toISOString()}>{formatDate(page.updatedAt)}</time>
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        <div className={styles.body}>
          {isFetching && !page ? (
            <div className={styles.card} aria-busy="true">
              <Skeleton style={{ height: "1.5rem", width: "40%", marginBottom: "1.25rem" }} />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} style={{ height: "1rem", width: `${92 - (i % 3) * 12}%`, marginBottom: "0.75rem" }} />
              ))}
            </div>
          ) : error && !page ? (
            <div className={styles.card}>
              <h2 className={styles.stateTitle}>This page could not be loaded</h2>
              <p className={styles.stateText}>Please try again in a moment.</p>
              {error instanceof Error && <p className={styles.errorMessage}>{error.message}</p>}
            </div>
          ) : !page ? (
            <div className={styles.card}>
              <h2 className={styles.stateTitle}>Not available</h2>
              <p className={styles.stateText}>This page is not available at the moment. Please check back later.</p>
            </div>
          ) : (
            <>
              {hasToc && (
                <div className={styles.mobileToc}>
                  <HelpArticleToc variant="collapsible" headings={headings} activeId={activeId} onSelect={scrollTo} />
                </div>
              )}
              <div className={`${styles.layout} ${hasToc ? "" : styles.layoutSingle}`}>
                <article className={styles.card}>
                  <div ref={contentRef} className={styles.content} dangerouslySetInnerHTML={markup} />
                </article>
                {hasToc && (
                  <aside className={styles.sidebar}>
                    <HelpArticleToc
                      variant="sidebar"
                      title="On this page"
                      headings={headings}
                      activeId={activeId}
                      onSelect={scrollTo}
                    />
                  </aside>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
