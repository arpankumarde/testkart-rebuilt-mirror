import React from "react";
import { ClipboardList, Laptop, Target, type LucideIcon } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import type { GlossaryCategory } from "../helpers/schema";
import styles from "./GlossaryCategoryTag.module.css";

const ICONS: Record<GlossaryCategory, LucideIcon> = {
  test_types: ClipboardList,
  scoring_and_assessment: Target,
  delivery_and_creation: Laptop,
};

interface GlossaryCategoryTagProps {
  category: GlossaryCategory;
  /** Uppercase, for the badge above a term's H1. */
  caps?: boolean;
  className?: string;
}

/** The small pastel tag above a term; each category keeps one colour and icon everywhere it appears. */
export const GlossaryCategoryTag: React.FC<GlossaryCategoryTagProps> = ({ category, caps = false, className }) => {
  const Icon = ICONS[category];
  return (
    <span className={`${styles.tag} ${styles[category]} ${caps ? styles.caps : ""} ${className ?? ""}`}>
      <Icon size={13} aria-hidden="true" />
      {glossaryMeta.categoryLabel(category)}
    </span>
  );
};