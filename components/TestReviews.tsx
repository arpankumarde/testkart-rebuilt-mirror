import React from 'react';
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

const StarRating: React.FC<{ rating: number; className?: string }> = ({ rating, className }) => {
  return (
    <div className={`${styles.starRating} ${className ?? ''}`}>
      {[...Array(5)].map((_, index) => (
        <Star
          key={index}
          className={index < rating ? styles.filledStar : styles.emptyStar}
          size={14}
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
    <Skeleton style={{ width: '100px', height: '1rem', marginTop: 'var(--spacing-2)' }} />
    <div className={styles.reviewBody}>
      <Skeleton style={{ width: '100%', height: '1rem' }} />
      <Skeleton style={{ width: '80%', height: '1rem' }} />
    </div>
  </div>
);

export const TestReviews: React.FC<{ mockTestId: number; className?: string }> = ({ mockTestId, className }) => {
  const { data, isFetching, error } = useReviewsQuery(mockTestId);

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <ReviewSkeleton />
          <ReviewSkeleton />
          <ReviewSkeleton />
        </>
      );
    }

    if (error) {
      return <p className={styles.message}>Error loading reviews. Please try again later.</p>;
    }

    if (!data || data.reviews.length === 0) {
      return (
        <div className={styles.message}>
          <MessageSquare size={48} className={styles.messageIcon} />
          <h3>No reviews yet</h3>
          <p>Be the first to share your thoughts on this test!</p>
        </div>
      );
    }

    return data.reviews.map((review) => (
      <div key={review.id} className={styles.reviewCard}>
        <div className={styles.reviewHeader}>
          <div className={styles.avatar}>
            {review.reviewerName.charAt(0).toUpperCase()}
          </div>
          <div className={styles.reviewerInfo}>
            <span className={styles.reviewerName}>{review.reviewerName}</span>
                        <span className={styles.reviewDate}>{review.createdAt ? formatTimeAgo(new Date(review.createdAt)) : 'Recently'}</span>
          </div>
        </div>
        <div className={styles.reviewMeta}>
          <StarRating rating={review.rating} className={styles.rating} />
          <span className={styles.testItemBadge}>
            {review.testItemTitle ? `Test: ${review.testItemTitle}` : 'Overall Package Review'}
          </span>
        </div>
        {review.reviewText && <p className={styles.reviewBody}>{review.reviewText}</p>}
      </div>
    ));
  };

  return (
    <div className={`${styles.reviewsContainer} ${className ?? ''}`}>
      <h2 className={styles.title}>Student Reviews</h2>
      <div className={styles.reviewsList}>
        {renderContent()}
      </div>
    </div>
  );
};