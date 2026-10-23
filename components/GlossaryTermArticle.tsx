import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import type { GlossaryCategory } from "../helpers/schema";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import type { PublicGlossaryTerm } from "../endpoints/glossary/details_GET.schema";
import { GlossaryCategoryTag } from "./GlossaryCategoryTag";
import { GlossaryCtaBand } from "./GlossaryCtaBand";
import { GlossaryTermCard } from "./GlossaryTermCard";
import styles from "./GlossaryTermArticle.module.css";

/** The term's content. A draft in the editor may not have a category yet. */
export type GlossaryArticleTerm = Omit<PublicGlossaryTerm, "category" | "seoTitle" | "seoDescription" | "canonicalUrl"> & {
  category: GlossaryCategory | null;
};

interface GlossaryTermArticleProps {
  term: GlossaryArticleTerm;
  /** Published related terms only. */
  related: PublicGlossaryCard[];
  /** The admin preview: links stay inert and missing content is called out. */
  preview?: boolean;
}

/*
 * The one layout of a term page (wireframe modules 2 to 8), rendered by the public page and by both
 * admin previews, so a preview cannot drift from what goes live.
 */
export const GlossaryTermArticle: React.FC<GlossaryTermArticleProps> = ({ term, related, preview = false }) => {
  const name = term.term.trim();
  const hub = (label: string) => (preview ? <span>{label}</span> : <Link to={glossaryMeta.HUB_PATH}>{label}</Link>);
  const paragraph = (html: string, placeholder: string) =>
    glossaryMeta.hasText(html) ? (
      <div className={styles.prose} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
    ) : preview ? (
      <p className={styles.missing}>{placeholder}</p>
    ) : null;

  const hasProduct = !!(term.productText?.trim() || term.productUrl?.trim());
  const hasExtra = !!term.extraHeading?.trim() && glossaryMeta.hasText(term.extraBody);

  return (
    <>
      <div className={styles.page}>
        <article className={styles.column}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <ol>
              <li>{preview ? <span>Home</span> : <Link to="/">Home</Link>}</li>
              <li>{hub("Glossary")}</li>
              <li aria-current="page">{name || "Term name"}</li>
            </ol>
          </nav>

          <header className={styles.header}>
            {term.category && <GlossaryCategoryTag category={term.category} caps />}
            <h1 className={styles.title}>{name || <span className={styles.missing}>Term name</span>}</h1>
            {term.definition.trim() ? (
              <p className={styles.definition}>{term.definition}</p>
            ) : (
              <p className={`${styles.definition} ${styles.missing}`}>One-line definition</p>
            )}
          </header>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{glossaryMeta.explanationHeading(name || "this term", term.explanationHeading)}</h2>
            {paragraph(term.explanationFirst, "First paragraph goes here.")}
            {paragraph(term.explanationSecond, "Second paragraph goes here.")}
            {hasExtra && (
              <>
                <h3 className={styles.extraTitle}>{term.extraHeading}</h3>
                {paragraph(term.extraBody ?? "", "")}
              </>
            )}
          </section>

          {hasProduct ? (
            <section className={styles.product} aria-labelledby="glossary-product-title">
              <span className={styles.productIcon} aria-hidden="true">
                <Rocket size={20} />
              </span>
              <div className={styles.productBody}>
                <h2 id="glossary-product-title" className={styles.productTitle}>
                  See it on Testkart
                </h2>
                {term.productText && <p className={styles.productText}>{term.productText}</p>}
                {term.productUrl && term.productLabel && (
                  preview ? (
                    <span className={styles.productLink}>
                      {term.productLabel} <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  ) : (
                    <Link to={term.productUrl} className={styles.productLink}>
                      {term.productLabel} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  )
                )}
              </div>
            </section>
          ) : (
            preview && <p className={styles.missing}>The See it on Testkart box goes here.</p>
          )}

          {related.length > 0 && (
            <section className={styles.section} aria-labelledby="glossary-related-title">
              <h2 id="glossary-related-title" className={styles.sectionTitle}>
                Related terms
              </h2>
              <div className={styles.relatedGrid}>
                {related.map((item) => (
                  <GlossaryTermCard key={item.slug} term={item} variant="related" preview={preview} />
                ))}
              </div>
            </section>
          )}
        </article>
      </div>

      <GlossaryCtaBand title="Create and sell your own tests on Testkart" preview={preview}>
        {preview ? (
          <span className={styles.back}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to Glossary
          </span>
        ) : (
          <Link to={glossaryMeta.HUB_PATH} className={styles.back}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to Glossary
          </Link>
        )}
      </GlossaryCtaBand>
    </>
  );
};