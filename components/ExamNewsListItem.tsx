import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import { examNewsPublicMeta } from "../helpers/examNewsPublicMeta";
import { EXAM_NEWS_TYPE_ICONS } from "../helpers/examNewsIcons";
import type { PublicExamNewsCard } from "../endpoints/exam-news/list_GET.schema";
import type { ExamNewsType } from "../helpers/schema";
import styles from "./ExamNewsListItem.module.css";

export const ExamNewsTypeBadge: React.FC<{ type: ExamNewsType; asLink?: boolean; className?: string }> = ({ type, asLink, className }) => {
  const Icon = EXAM_NEWS_TYPE_ICONS[type];
  const content = (
    <>
      <Icon size={12} aria-hidden="true" />
      {examNewsPublicMeta.typeLabel(type)}
    </>
  );
  const classes = `${styles.badge} ${styles[`type_${type}`] ?? ""} ${className ?? ""}`;
  return asLink ? (
    <Link to={examNewsPublicMeta.listingPath({ type })} className={`${classes} ${styles.badgeLink}`}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
};

interface ExamNewsListItemProps {
  item: PublicExamNewsCard;
  /* Smaller row for side lists: no summary, no thumbnail. */
  compact?: boolean;
  headingLevel?: "h2" | "h3";
}

export const ExamNewsListItem: React.FC<ExamNewsListItemProps> = ({ item, compact = false, headingLevel = "h2" }) => {
  const href = examNewsPublicMeta.storyPath(item.slug);
  const Heading = headingLevel;
  const updated = examNewsPublicMeta.wasUpdated(item.publishedAt, item.updatedAt);
  const TypeIcon = EXAM_NEWS_TYPE_ICONS[item.newsType];

  if (compact) {
    return (
      <article className={styles.compact}>
        <div className={styles.compactTop}>
          <ExamNewsTypeBadge type={item.newsType} />
          {item.examName && <span className={styles.compactExam}>{item.examName}</span>}
        </div>
        <Heading className={styles.compactTitle}>
          <Link to={href}>{item.title}</Link>
        </Heading>
        <time className={styles.compactDate} dateTime={item.publishedAt ? new Date(item.publishedAt).toISOString() : undefined}>
          {examNewsPublicMeta.formatDate(item.publishedAt)}
        </time>
      </article>
    );
  }

  return (
    <article className={styles.item}>
      {item.thumbnailUrl ? (
        <Link to={href} className={styles.thumbLink} tabIndex={-1} aria-hidden="true">
          <img src={item.thumbnailUrl} alt={item.thumbnailAlt ?? ""} className={styles.thumb} loading="lazy" />
        </Link>
      ) : (
        // Same box as a photo thumbnail, so rows with and without images line up.
        <Link to={href} className={`${styles.thumbLink} ${styles.thumbTile} ${styles[`tile_${item.newsType}`] ?? ""}`} tabIndex={-1} aria-hidden="true">
          <span className={styles.tileIcon}>
            <TypeIcon size={22} />
          </span>
          <span className={styles.tileLabel}>{examNewsPublicMeta.typeLabel(item.newsType)}</span>
        </Link>
      )}

      <div className={styles.body}>
        <div className={styles.tags}>
          <ExamNewsTypeBadge type={item.newsType} />
          {item.examName && item.examSlug && (
            <Link to={examNewsPublicMeta.listingPath({ examSlug: item.examSlug })} className={styles.examLink}>
              {item.examName}
            </Link>
          )}
        </div>
        <Heading className={styles.title}>
          <Link to={href}>{item.title}</Link>
        </Heading>
        {item.summary && <p className={styles.summary}>{item.summary}</p>}
        <div className={styles.footer}>
          <ul className={styles.meta}>
            <li>
              <CalendarDays size={13} aria-hidden="true" />
              <time dateTime={item.publishedAt ? new Date(item.publishedAt).toISOString() : undefined}>
                {examNewsPublicMeta.formatDate(item.publishedAt)}
              </time>
            </li>
            {updated && (
              <li>
                <RefreshCw size={13} aria-hidden="true" />
                Updated <time dateTime={new Date(item.updatedAt).toISOString()}>{examNewsPublicMeta.formatDate(item.updatedAt)}</time>
              </li>
            )}
          </ul>
          <Link to={href} className={styles.readLink} aria-label={`Read update: ${item.title}`}>
            Read update <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
};