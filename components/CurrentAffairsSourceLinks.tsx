import React from "react";
import { ExternalLink, Link2 } from "lucide-react";
import styles from "./CurrentAffairsSourceLinks.module.css";

type Source = { name: string; url: string };

interface CurrentAffairsSourceLinksProps {
  sources: Source[];
  /* h3 under a story heading, h2 for a digest's own references. */
  headingLevel?: 2 | 3;
  /* Shown when there is nothing to list; without it the section is left out. */
  emptyText?: string;
  className?: string;
}

/** The site a link points at, for sources saved without a name: "pib.gov.in". */
const siteOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * "Sources & References": each source its own pill, labelled with the publication name and opening
 * in a new tab. Pills wrap onto new lines instead of running together as comma-separated text.
 */
export const CurrentAffairsSourceLinks: React.FC<CurrentAffairsSourceLinksProps> = ({
  sources,
  headingLevel = 3,
  emptyText,
  className,
}) => {
  const filled = sources.map((s) => ({ name: s.name.trim(), url: s.url.trim() })).filter((s) => s.name || s.url);
  if (filled.length === 0 && !emptyText) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section className={`${styles.root} ${className ?? ""}`}>
      <Heading className={styles.heading}>
        <Link2 size={14} aria-hidden="true" />
        Sources &amp; References
      </Heading>
      {filled.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul className={styles.list}>
          {filled.map((source, index) => (
            <li key={`${source.url}-${index}`} className={styles.entry}>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className={styles.source} title={source.url}>
                  <span className={styles.name}>{source.name || siteOf(source.url)}</span>
                  <ExternalLink size={12} aria-hidden="true" className={styles.icon} />
                  <span className={styles.srOnly}> (opens in a new tab)</span>
                </a>
              ) : (
                <span className={`${styles.source} ${styles.plain}`}>
                  <span className={styles.name}>{source.name}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};