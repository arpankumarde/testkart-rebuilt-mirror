import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, FileText, GraduationCap, LayoutGrid, ListChecks, Network, Sparkles } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import { GlossaryCategoryLabel } from "./GlossaryCategoryLabel";
import { PlayfulButton } from "./PlayfulButton";
import styles from "./GlossaryTermSidebar.module.css";

const EXPLORE_LINKS = [
  { href: "/mock-test", label: "Test Series", icon: ListChecks },
  { href: "/course", label: "Courses", icon: GraduationCap },
  { href: "/study-notes", label: "Study Notes", icon: FileText },
];

interface GlossaryTermSidebarProps {
  /** Published related terms only. */
  related: PublicGlossaryCard[];
  /** Renders without links, for the admin preview. */
  preview?: boolean;
}

export const GlossaryTermSidebar: React.FC<GlossaryTermSidebarProps> = ({ related, preview = false }) => {
  const target = (to: string, className: string, children: React.ReactNode) =>
    preview ? (
      <span className={className}>{children}</span>
    ) : (
      <Link to={to} className={className}>
        {children}
      </Link>
    );

  return (
    <aside className={styles.sidebar} aria-label="More on this topic">
      {related.length > 0 && (
        <section className={styles.panel} aria-labelledby="glossary-related-title">
          <h2 id="glossary-related-title" className={styles.heading}>
            <span className={`${styles.icon} ${styles.lavender}`} aria-hidden="true">
              <Network size={16} />
            </span>
            Related Terms
          </h2>
          <ul className={styles.list}>
            {related.map((item) => (
              <li key={item.slug}>
                {target(
                  glossaryMeta.termPath(item.slug),
                  `${styles.term} ${styles[item.category]}`,
                  <>
                    <div className={styles.termText}>
                      <h3 className={styles.termName}>{item.term}</h3>
                      <span className={styles.termDefinition}>{item.definition}</span>
                    </div>
                    <ArrowRight size={15} className={styles.arrow} aria-hidden="true" />
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.panel}>
        <section aria-labelledby="glossary-categories-title">
          <h2 id="glossary-categories-title" className={styles.heading}>
            <span className={`${styles.icon} ${styles.mint}`} aria-hidden="true">
              <LayoutGrid size={16} />
            </span>
            Browse Categories
          </h2>
          <ul className={styles.list}>
            {glossaryMeta.CATEGORIES.map(({ value }) => (
              <li key={value}>
                {target(`${glossaryMeta.HUB_PATH}?category=${value}`, styles.link, <GlossaryCategoryLabel category={value} className={styles.categoryLabel} />)}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.explore} aria-labelledby="glossary-explore-title">
          <h2 id="glossary-explore-title" className={styles.heading}>
            <span className={`${styles.icon} ${styles.powder}`} aria-hidden="true">
              <Compass size={16} />
            </span>
            Explore More
          </h2>
          <ul className={styles.list}>
            {EXPLORE_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                {target(
                  href,
                  styles.link,
                  <>
                    <Icon size={16} strokeWidth={1.75} className={styles.linkIcon} aria-hidden="true" />
                    {label}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={styles.cta} aria-labelledby="glossary-cta-title">
        <h2 id="glossary-cta-title" className={styles.ctaTitle}>
          <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" />
          Ready to create your own tests?
        </h2>
        <p className={styles.ctaText}>Explore Testkart's tools for creating and selling online mock tests.</p>
        <PlayfulButton asChild tone="soft" size="sm" className={styles.ctaButton}>
          {preview ? (
            <span>
              Explore Testkart <ArrowRight size={16} aria-hidden="true" />
            </span>
          ) : (
            <Link to="/teach">
              Explore Testkart <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </PlayfulButton>
      </section>
    </aside>
  );
};