import React from "react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import type { GlossaryCategory } from "../helpers/schema";
import styles from "./GlossaryCategoryLabel.module.css";

interface GlossaryCategoryLabelProps {
  category: GlossaryCategory;
  /** A small pastel badge, for above a term's H1. Plain muted text with a dot otherwise. */
  badge?: boolean;
  className?: string;
}

/** The public name of a category, with its colour. */
export const GlossaryCategoryLabel: React.FC<GlossaryCategoryLabelProps> = ({ category, badge = false, className }) => (
  <span className={`${styles.label} ${styles[category]} ${badge ? styles.badge : ""} ${className ?? ""}`}>
    {glossaryMeta.publicCategoryLabel(category)}
  </span>
);