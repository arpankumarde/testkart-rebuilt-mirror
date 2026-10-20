import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  IndianRupee,
  Layers,
  Presentation,
  Radio,
  Settings2,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PublicPostListItem } from "../endpoints/blog/list_GET.schema";
import styles from "./HelpCategoryCard.module.css";

export const HELP_CARD_TONES = ["peach", "lavender", "sage", "blue", "butter", "mint"] as const;
export type HelpCardTone = (typeof HELP_CARD_TONES)[number];

export type HelpCardVariant = "featured" | "medium" | "compact";

/** Card size follows the topic's published article count. */
export const helpCardVariant = (articleCount: number): HelpCardVariant =>
  articleCount >= 5 ? "featured" : articleCount >= 3 ? "medium" : "compact";

const PREVIEW_LIMITS: Record<HelpCardVariant, number> = { featured: 4, medium: 4, compact: 2 };

/* Help categories carry no usable icon of their own, so one is picked from the
   slug. First match wins, which is why course-management sits above course. */
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/subscription|plan|billing/, BadgeCheck],
  [/earning|withdraw|payout|wallet/, Wallet],
  [/pricing|monetis|monetiz/, IndianRupee],
  [/marketing|growth/, TrendingUp],
  [/question/, Layers],
  [/live/, Radio],
  [/mock|test/, ClipboardList],
  [/course-management|manage/, Settings2],
  [/course/, GraduationCap],
  [/note|ebook/, BookOpen],
  [/exam/, Target],
  [/teacher|educator/, Presentation],
];

export const helpCategoryIcon = (slug: string | null | undefined): LucideIcon =>
  ICON_RULES.find(([pattern]) => slug && pattern.test(slug))?.[1] ?? FolderOpen;

interface HelpCategoryCardProps {
  name: string;
  /** Null for the catch-all card of uncategorised articles, which has no listing page and so lists every article. */
  slug: string | null;
  description?: string | null;
  articleCount: number;
  posts: PublicPostListItem[];
  tone: HelpCardTone;
  variant: HelpCardVariant;
}

export const HelpCategoryCard = ({
  name,
  slug,
  description,
  articleCount,
  posts,
  tone,
  variant,
}: HelpCategoryCardProps) => {
  const Icon = helpCategoryIcon(slug);
  const countLabel = `${articleCount} article${articleCount === 1 ? "" : "s"}`;
  const shown = slug ? posts.slice(0, PREVIEW_LIMITS[variant]) : posts;
  const hasMore = articleCount > shown.length;
  const cardClass = [styles.card, styles[variant], styles[tone]].filter(Boolean).join(" ");

  const heading = (
    <>
      <span className={styles.iconTile} aria-hidden="true">
        <Icon size={variant === "compact" ? 20 : 22} />
      </span>
      <div className={styles.heading}>
        <h3 className={styles.name}>{name}</h3>
        <span className={styles.count}>{countLabel}</span>
      </div>
    </>
  );

  const explore = slug && (
    <Link
      to={`/help?category=${slug}`}
      className={styles.explore}
      aria-label={hasMore ? `View all ${countLabel} in ${name}` : `Explore ${name}`}
    >
      {hasMore ? `View all ${countLabel}` : "Explore topic"}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );

  const list = (
    <ul className={styles.list}>
      {shown.map((post) => (
        <li key={post.id}>
          <Link to={`/help/${post.slug}`} className={styles.article}>
            <FileText size={16} className={styles.articleIcon} aria-hidden="true" />
            <span className={styles.articleTitle}>{post.title.trim()}</span>
            <ChevronRight size={16} className={styles.articleArrow} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );

  if (variant === "featured") {
    return (
      <article className={cardClass}>
        <div className={styles.featuredInner}>
          <div className={styles.aside}>
            <div className={styles.header}>{heading}</div>
            {description && <p className={styles.description}>{description}</p>}
            {explore}
          </div>
          {list}
        </div>
      </article>
    );
  }

  return (
    <article className={cardClass}>
      <div className={styles.stackInner}>
        <header className={styles.header}>{heading}</header>
        {description && <p className={styles.description}>{description}</p>}
        {list}
        {explore}
      </div>
    </article>
  );
};
