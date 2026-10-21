import React, { useMemo } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { useReviewsQuery } from '../helpers/useReviewsQuery';
import { Skeleton } from './Skeleton';
import styles from './TestReviews.module.css';

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)} years ago`;
  
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)} months ago`;
  
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)} days ago`;
  
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)} hours ago`;
  
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)} minutes ago`;
  
  return `${Math.floor(seconds)} seconds ago`;
};

const StarRating: React.FC<{ rating: number; size?: number; className?: string }> = ({ rating, size = 14, className }) => {
  return (
    <div className={`${styles.starRating} ${className ?? ''}`}>
      {[...Array(5)].map((_, index) => (
        <Star
          key={index}
          className={index < Math.round(rating) ? styles.filledStar : styles.emptyStar}
          fill={index < Math.round(rating) ? 'currentColor' : 'none'}
          size={size}
        />
      ))}
    </div>
  );
};

const ReviewSkeleton: React.FC = () => (
  <div className={styles.reviewCard}>
    <div className={styles.reviewHeader}>
      <Skeleton style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)' }} />
      <div className={styles.reviewerInfo}>
        <Skeleton style={{ width: '120px', height: '1rem' }} />
        <Skeleton style={{ width: '80px', height: '0.8rem' }} />
      </div>
    </div>
    <div className={styles.reviewBody}>
      <Skeleton style={{ width: '100%', height: '1rem' }} />
      <Skeleton style={{ width: '80%', height: '1rem', marginTop: 'var(--spacing-2)' }} />
    </div>
  </div>
);

interface TestReviewsProps {
  mockTestId: number;
  /** Package average and count from the details payload, for the summary. */
  rating?: number | null;
  reviewsCount?: number;
  className?: string;
}

/** Review list for a test series. The page section supplies the heading. */
export const TestReviews: React.FC<TestReviewsProps> = ({ mockTestId, rating, reviewsCount, className }) => {
  const { data, isFetching, error } = useReviewsQuery(mockTestId);
  const reviews = data?.reviews ?? [];

  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[Math.floor(r.rating) as keyof typeof counts]++;
      }
    });
    return counts;
  }, [reviews]);

  const averageRating = rating ? Number(rating) : null;
  const showSummary = averageRating !== null && reviews.length > 0;

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <>
          <ReviewSkeleton />
          <ReviewSkeleton />
        </>
      );
    }

    if (error) {
      return <p className={styles.message}>Error loading reviews. Please try again later.</p>;
    }

    if (reviews.length === 0) {
      return (
        <div className={styles.message}>
          <MessageSquare size={40} className={styles.messageIcon} aria-hidden="true" />
          <h3>No reviews yet</h3>
          <p>Be the first to share your thoughts on this test!</p>
        </div>
      );
    }

    return reviews.map((review) => (
      <div key={review.id} className={styles.reviewCard}>
        <div className={styles.reviewHeader}>
          <div className={styles.avatar} aria-hidden="true">
            {review.reviewerName.charAt(0).toUpperCase()}
          </div>
          <div className={styles.reviewerInfo}>
            <span className={styles.reviewerName}>{review.reviewerName}</span>
            <span className={styles.reviewDate}>{review.createdAt ? formatTimeAgo(new Date(review.createdAt)) : 'Recently'}</span>
          </div>
          <StarRating rating={review.rating} />
        </div>
        <span className={styles.testItemBadge}>
          {review.testItemTitle ? `Test: ${review.testItemTitle}` : 'Overall Package Review'}
        </span>
        {review.reviewText && <p className={styles.reviewBody}>{review.reviewText}</p>}
      </div>
    ));
  };

  return (
    <div className={`${styles.reviewsContainer} ${className ?? ''}`}>
      {showSummary && (
        <div className={styles.ratingSummary}>
          <div className={styles.averageRating}>
            <span className={styles.bigRating}>{averageRating.toFixed(1)}</span>
            <StarRating rating={averageRating} size={20} />
            <span className={styles.totalReviews}>{(reviewsCount ?? reviews.length).toLocaleString()} reviews</span>
          </div>
          <div className={styles.ratingBars}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = ratingCounts[stars as keyof typeof ratingCounts];
              const percentage = (count / reviews.length) * 100;
              return (
                <div key={stars} className={styles.ratingBarRow}>
                  <span className={styles.starLabel}>
                    {stars} <Star size={12} fill="currentColor" className={styles.filledStar} aria-hidden="true" />
                  </span>
                  <div className={styles.barContainer}>
                    <div className={styles.barFill} style={{ width: `${percentage}%` }} />
                  </div>
                  <span className={styles.barCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.reviewsList}>
        {renderContent()}
      </div>
    </div>
  );
};
