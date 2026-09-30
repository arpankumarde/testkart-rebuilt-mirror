import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import styles from "./ExamCategoryCard.module.css";

export interface ExamCategory {
  name: string;
  route: string;
  icon: LucideIcon;
  /** Pastel hex for the bottom accent and the icon's backing shape. */
  accentColor: string;
}

interface ExamCategoryCardProps {
  exam: ExamCategory;
  /** Products on sale for the exam, shown under the name; omitted when unknown or 0. */
  productCount?: number;
  className?: string;
}

/**
 * Large rounded exam card: name and product count on top, arrow bottom-left,
 * a duotone icon (outlined lucide glyph over a pastel blob) bottom-right, and
 * a pastel strip peeking out from under the bottom edge. The whole card is one
 * link.
 */
export function ExamCategoryCard({ exam, productCount, className }: ExamCategoryCardProps) {
  const Icon = exam.icon;

  return (
    <Link
      to={exam.route}
      className={`${styles.root} ${className ?? ""}`}
      style={{ "--exam-accent": exam.accentColor } as CSSProperties}
    >
      <span className={styles.accent} aria-hidden />
      <span className={styles.card}>
        <span className={styles.heading}>
          <h3 className={styles.title}>{exam.name}</h3>
          {productCount != null && productCount > 0 && (
            <span className={styles.count}>
              {productCount.toLocaleString("en-IN")} {productCount === 1 ? "product" : "products"}
            </span>
          )}
        </span>
        <span className={styles.footer}>
          <ArrowUpRight className={styles.arrow} strokeWidth={2} aria-hidden />
          <span className={styles.illustration} aria-hidden>
            <span className={styles.blob} />
            <Icon className={styles.icon} strokeWidth={1.75} />
          </span>
        </span>
      </span>
    </Link>
  );
}
