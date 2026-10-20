import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import type { PublicPostListItem } from "../endpoints/blog/list_GET.schema";
import styles from "./HelpArticleCard.module.css";

interface HelpArticleCardProps {
  post: PublicPostListItem;
  /** "feature" stacks the thumbnail over the title; "row" sets it beside. Both go to "row" on phones. */
  layout?: "feature" | "row";
  showExcerpt?: boolean;
}

/**
 * One help article as a whole-card link, used by the /help popular guides and
 * the search and topic listings. The thumbnail is the post's own image (the
 * list endpoint returns ogImage, else featuredImage); a post without one gets
 * no placeholder.
 */
export const HelpArticleCard = ({ post, layout = "row", showExcerpt = false }: HelpArticleCardProps) => {
  const className = [styles.card, styles[layout], post.featuredImage ? "" : styles.noThumb]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/help/${post.slug}`} className={className}>
      {post.featuredImage && (
        <span className={styles.thumb}>
          <img src={post.featuredImage} alt="" width={1672} height={941} loading="lazy" decoding="async" />
        </span>
      )}
      <span className={styles.body}>
        {post.categoryName && <span className={styles.category}>{post.categoryName}</span>}
        <span className={styles.title}>{post.title.trim()}</span>
        {showExcerpt && post.excerpt && <span className={styles.excerpt}>{post.excerpt}</span>}
        <span className={styles.meta}>
          <Clock size={14} aria-hidden="true" />
          {post.readingTimeMinutes} min read
          <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
};
