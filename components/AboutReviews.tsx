import React from "react";
import { ArrowUpRight, ExternalLink, Star } from "lucide-react";
import { useExternalReviewsQuery } from "../helpers/useExternalReviewsQuery";
import {
  REVIEWS_BADGE,
  REVIEWS_BADGE_COMPACT,
  REVIEWS_SOURCE,
  type ExternalReview,
} from "../endpoints/reviews/external_GET.schema";
import { PlayfulButton } from "./PlayfulButton";
import styles from "./AboutReviews.module.css";

const VISIBLE_REVIEWS = 3;

const formatMonth = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(date));

const clampRating = (rating: number) => Math.max(0, Math.min(5, rating));

const ReviewCard: React.FC<{ review: ExternalReview }> = ({ review }) => {
  const link = review.url ?? REVIEWS_SOURCE.url;

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.reviewerLabel}>{review.reviewerLabel ?? "Reviewer"}</span>
        {review.rating !== null && (
          <span className={styles.cardRating}>
            <Star size={14} aria-hidden="true" />
            {clampRating(review.rating).toFixed(1)}
            <span className={styles.srOnly}> out of 5</span>
          </span>
        )}
      </div>
      {review.title && <h4 className={styles.cardTitle}>{review.title}</h4>}
      <p className={styles.cardText}>{review.excerpt}</p>
      {review.tags.length > 0 && (
        <ul className={styles.tags}>
          {review.tags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.cardFoot}>
        <span className={styles.reviewerMeta}>
          {REVIEWS_SOURCE.name}
          {review.postedOn ? ` - ${formatMonth(review.postedOn)}` : ""}
        </span>
        <a
          className={styles.cardLink}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Read this review on ${REVIEWS_SOURCE.name} (opens in a new tab)`}
        >
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
};

const SourceButton: React.FC<{ label: string }> = ({ label }) => (
  <PlayfulButton asChild tone="primary" size="md">
    <a href={REVIEWS_SOURCE.url} target="_blank" rel="noopener noreferrer">
      {label}
      <ExternalLink aria-hidden="true" />
      <span className={styles.srOnly}>(opens in a new tab)</span>
    </a>
  </PlayfulButton>
);

/* The official badge, embedded as AmbitionBox issues it: the image is never
   cropped, recoloured or overlaid, only scaled to fit. CSS shows one of the two
   links at a time, so the hidden one is skipped by assistive tech as well. */
const BadgeLink: React.FC<{
  badge: typeof REVIEWS_BADGE | typeof REVIEWS_BADGE_COMPACT;
  className: string;
  onError: () => void;
}> = ({ badge, className, onError }) => (
  <a
    className={`${styles.badgeLink} ${className}`}
    href={REVIEWS_SOURCE.url}
    target="_blank"
    rel="noopener noreferrer"
  >
    <img
      className={styles.badgeImage}
      src={badge.src}
      alt={badge.alt}
      width={badge.width}
      height={badge.height}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
    <span className={styles.srOnly}>(opens in a new tab)</span>
  </a>
);

export const AboutReviews: React.FC<{ className?: string }> = ({ className }) => {
  const { data } = useExternalReviewsQuery();
  const [badgeFailed, setBadgeFailed] = React.useState(false);

  const reviews = (data?.reviews ?? []).slice(0, VISIBLE_REVIEWS);
  const onBadgeError = () => setBadgeFailed(true);

  return (
    <section className={`${styles.reviews} ${className ?? ""}`} aria-labelledby="about-reviews-heading">
      <div className={styles.header}>
        <span className={styles.accent} aria-hidden="true" />
        <h2 id="about-reviews-heading" className={styles.heading}>
          What People Say About Testkart
        </h2>
        <p className={styles.subtitle}>
          Real employee experiences and workplace insights from {REVIEWS_SOURCE.name}.
        </p>
      </div>

      {badgeFailed ? (
        <div className={styles.notice}>
          <p className={styles.noticeText}>
            Reviews of Testkart are published on {REVIEWS_SOURCE.name}. Read what people say there, in their own words.
          </p>
          <div className={styles.noticeActions}>
            <SourceButton label={`Read reviews on ${REVIEWS_SOURCE.name}`} />
          </div>
        </div>
      ) : (
        <div className={styles.overview}>
          <div className={styles.summary}>
            <p className={styles.kicker}>{REVIEWS_SOURCE.name} rating</p>
            <p className={styles.summaryText}>
              Employee ratings for Testkart, shown exactly as {REVIEWS_SOURCE.name} publishes them.
            </p>
            <div className={styles.summaryFoot}>
              <SourceButton label={`Read reviews on ${REVIEWS_SOURCE.name}`} />
              <p className={styles.attribution}>Badge issued by {REVIEWS_SOURCE.name}.</p>
            </div>
          </div>

          <div className={styles.badgeStage}>
            <BadgeLink badge={REVIEWS_BADGE} className={styles.badgeDetailed} onError={onBadgeError} />
            <BadgeLink badge={REVIEWS_BADGE_COMPACT} className={styles.badgeCompact} onError={onBadgeError} />
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className={styles.recent}>
          <div className={styles.recentHead}>
            <h3 className={styles.recentHeading}>Recent Reviews</h3>
            <a className={styles.textLink} href={REVIEWS_SOURCE.url} target="_blank" rel="noopener noreferrer">
              View all reviews
              <ArrowUpRight size={16} aria-hidden="true" />
              <span className={styles.srOnly}>(opens in a new tab)</span>
            </a>
          </div>
          <div className={styles.cards}>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
