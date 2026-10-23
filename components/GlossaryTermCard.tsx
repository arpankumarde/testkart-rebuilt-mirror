import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import { GlossaryCategoryTag } from "./GlossaryCategoryTag";
import styles from "./GlossaryTermCard.module.css";

interface GlossaryTermCardProps {
  term: PublicGlossaryCard;
  /** Hub cards carry the category tag; related cards are the name, meaning and link. */
  variant?: "hub" | "related";
  /** Renders without links, for the admin preview. */
  preview?: boolean;
  className?: string;
}

/** The whole card is the link, through the stretched Read definition link. */
export const GlossaryTermCard: React.FC<GlossaryTermCardProps> = ({ term, variant = "hub", preview = false, className }) => (
  <article className={`${styles.card} ${styles[term.category]} ${styles[variant]} ${preview ? "" : styles.linked} ${className ?? ""}`}>
    {variant === "hub" && <GlossaryCategoryTag category={term.category} />}
    <h3 className={styles.title}>{term.term}</h3>
    <p className={styles.definition}>{term.definition}</p>
    {preview ? (
      <span className={styles.read}>
        Read definition <ArrowRight size={15} aria-hidden="true" />
      </span>
    ) : (
      <Link to={glossaryMeta.termPath(term.slug)} className={styles.read} aria-label={`Read definition of ${term.term}`}>
        Read definition <ArrowRight size={15} aria-hidden="true" />
      </Link>
    )}
  </article>
);