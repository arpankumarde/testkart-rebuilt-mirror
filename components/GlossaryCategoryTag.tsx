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
  className?: string;
}

/** The pastel category tag of the admin glossary; each category keeps one colour and icon. */
export const GlossaryCategoryTag: React.FC<GlossaryCategoryTagProps> = ({ category, className }) => {
  const Icon = ICONS[category];
  return (
    <span className={`${styles.tag} ${styles[category]} ${className ?? ""}`}>
      <Icon size={13} aria-hidden="true" />
      {glossaryMeta.categoryLabel(category)}
    </span>
  );
};