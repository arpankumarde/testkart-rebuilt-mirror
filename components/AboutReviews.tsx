import React from "react";
import { ArrowUpRight, ExternalLink, Star } from "lucide-react";
import { useExternalReviewsQuery } from "../helpers/useExternalReviewsQuery";
import { REVIEWS_BADGE, REVIEWS_SOURCE, type ExternalReview } from "../endpoints/reviews/external_GET.schema";
import { PlayfulButton } from "./PlayfulButton";
import { Skeleton } from "./Skeleton";
import styles from "./AboutReviews.module.css";

const VISIBLE_REVIEWS = 3;

const formatMonth = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(date));

const formatMonthLong = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(date));

const clampRating = (rating: number) => Math.max(0, Math.min(5, rating));

const Stars: React.FC<{ rating: number; size?: number }> = ({ rating, size = 16 }) => {
  const clamped = clampRating(rating);
  const row = [0, 1, 2, 3, 4].map((index) => <Star key={index} size={size} aria-hidden="true" />);

  return (
    <span className={styles.stars} role="img" aria-label={`Rated ${clamped} out of 5`}>
      <span className={styles.starsBase}>{row}</span>
      <span className={styles.starsFill} style={{ width: `${(clamped / 5) * 100}%` }}>
        {row}
      </span>
    </span>
  );
};

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

export const AboutReviews: React.FC<{ className?: string }> = ({ className }) => {
  const { data, isLoading, isError, refetch, isFetching } = useExternalReviewsQuery();
  const [badgeFailed, setBadgeFailed] = React.useState(false);

  const summary = data?.summary ?? null;
  const categories = data?.categories ?? [];
  const reviews = (data?.reviews ?? []).slice(0, VISIBLE_REVIEWS);
  const asOf = data?.asOf ?? null;
  const hasRatings = summary !== null || categories.length > 0;

  const bestCategory = categories.reduce((best, c) => Math.max(best, c.value), 0);
  const worstCategory = categories.reduce((worst, c) => Math.min(worst, c.value), 5);

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

      {isLoading && (
        <div className={styles.overview} aria-busy="true" aria-label="Loading ratings">
          <Skeleton className={styles.skeletonPanel} />
          <Skeleton className={styles.skeletonPanel} />
        </div>
      )}

      {isError && (
        <div className={styles.notice} role="alert">
          <p className={styles.noticeText}>The ratings could not be loaded just now.</p>
          <div className={styles.noticeActions}>
            <PlayfulButton tone="soft" size="md" onClick={() => refetch()} disabled={isFetching} aria-busy={isFetching}>
              Try again
            </PlayfulButton>
            <SourceButton label={`Read them on ${REVIEWS_SOURCE.name}`} />
          </div>
        </div>
      )}

      {!isLoading && !isError && !hasRatings && (
        <div className={styles.notice}>
          <p className={styles.noticeText}>
            Reviews of Testkart are published on {REVIEWS_SOURCE.name}. Read what people say there, in their own words.
          </p>
          <div className={styles.noticeActions}>
            <SourceButton label={`Read reviews on ${REVIEWS_SOURCE.name}`} />
          </div>
        </div>
      )}

      {!isLoading && !isError && hasRatings && (
        <div className={styles.overview}>
          <div className={`${styles.panel} ${styles.panelWarm}`}>
            <p className={styles.panelLabel}>{REVIEWS_SOURCE.name} rating</p>
            {summary ? (
              <>
                <div className={styles.ratingRow}>
                  <span className={styles.ratingValue}>{clampRating(summary.rating).toFixed(1)}</span>
                  <span className={styles.ratingOutOf}>out of 5</span>
                </div>
                <Stars rating={summary.rating} size={20} />
                <p className={styles.ratingCount}>
                  Based on {summary.reviewCount.toLocaleString("en-IN")} reviews
                </p>
              </>
            ) : !badgeFailed ? (
              <img
                className={styles.badge}
                src={REVIEWS_BADGE.src}
                width={REVIEWS_BADGE.width}
                height={REVIEWS_BADGE.height}
                alt={`${REVIEWS_SOURCE.name} top category ratings for Testkart`}
                loading="lazy"
                decoding="async"
                onError={() => setBadgeFailed(true)}
              />
            ) : (
              <p className={styles.ratingStatement}>
                Employees rate Testkart{" "}
                <strong>
                  {worstCategory === bestCategory
                    ? bestCategory.toFixed(1)
                    : `${worstCategory.toFixed(1)} to ${bestCategory.toFixed(1)}`}
                </strong>{" "}
                out of 5 across its top {categories.length} categories.
              </p>
            )}
            <div className={styles.panelFoot}>
              <SourceButton label={`Read reviews on ${REVIEWS_SOURCE.name}`} />
              <p className={styles.attribution}>
                Ratings published by {REVIEWS_SOURCE.name}
                {asOf ? `, as of ${formatMonthLong(asOf)}` : ""}.
              </p>
            </div>
          </div>

          {categories.length > 0 && (
            <div className={styles.panel}>
              <p className={styles.panelLabel}>Top category ratings</p>
              <ul className={styles.bars}>
                {categories.map((category) => (
                  <li key={category.label} className={styles.bar}>
                    <span className={styles.barLabel}>{category.label}</span>
                    <span className={styles.barTrack} aria-hidden="true">
                      <span
                        className={styles.barFill}
                        style={{ width: `${(clampRating(category.value) / 5) * 100}%` }}
                      />
                    </span>
                    <span className={styles.barValue}>
                      {clampRating(category.value).toFixed(1)}
                      <span className={styles.srOnly}> out of 5</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!isLoading && !isError && reviews.length > 0 && (
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
