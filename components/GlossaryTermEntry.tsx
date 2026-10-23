import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import { GlossaryCategoryLabel } from "./GlossaryCategoryLabel";
import styles from "./GlossaryTermEntry.module.css";

interface GlossaryTermEntryProps {
  term: PublicGlossaryCard;
  className?: string;
}

/** One dictionary entry on the hub. The whole entry is the link, through the stretched Read definition link. */
export const GlossaryTermEntry: React.FC<GlossaryTermEntryProps> = ({ term, className }) => (
  <article className={`${styles.entry} ${styles[term.category]} ${className ?? ""}`}>
    <h3 className={styles.title}>{term.term}</h3>
    <p className={styles.definition}>{term.definition}</p>
    <p className={styles.meta}>
      <GlossaryCategoryLabel category={term.category} badge className={styles.category} />
      <span className={styles.separator} aria-hidden="true">
        ·
      </span>
      <Link to={glossaryMeta.termPath(term.slug)} className={styles.read} aria-label={`Read definition of ${term.term}`}>
        Read definition <ArrowRight size={14} className={styles.arrow} aria-hidden="true" />
      </Link>
    </p>
  </article>
);