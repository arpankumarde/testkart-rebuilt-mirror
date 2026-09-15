import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { useReviewsQuery } from '../helpers/useReviewsQuery';
import { useTeacherLatestReviews } from '../helpers/useTeacherLatestReviews';
import type { LatestReview } from '../endpoints/teacher/reviews/latest_GET.schema';
import type { OutputType as ReviewListOutput } from '../endpoints/reviews/list_GET.schema';
import { Badge } from '../components/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { TeacherListToolbar, teacherToolbarControlClass } from '../components/TeacherListToolbar';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherListPagination } from '../components/TeacherListPagination';
import { Star, MessageSquare, AlertTriangle } from 'lucide-react';
import styles from './teacher.reviews.module.css';

const ALL_TESTS = 'all';

const StarRating = ({ rating }: { rating: number }) => (
  <div className={styles.stars} role="img" aria-label={`Rated ${rating} out of 5`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={16}
        aria-hidden="true"
        className={i < rating ? styles.filledStar : styles.emptyStar}
      />
    ))}
  </div>
);

const ReviewCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <Skeleton style={{ height: '1.25rem', width: '200px' }} />
      <Skeleton style={{ height: '1rem', width: '80px' }} />
    </div>
    <Skeleton style={{ height: '1rem', width: '120px' }} />
    <Skeleton style={{ height: '1rem', width: '100%' }} />
    <Skeleton style={{ height: '1rem', width: '80%' }} />
  </div>
);

type TestReview = ReviewListOutput['reviews'][number];
type CombinedReview = LatestReview | TestReview;

const REVIEWS_PER_PAGE = 5;

const TeacherReviewsPage: React.FC = () => {
  const { data: tests, isFetching: isFetchingTests } = useTeacherTestsQuery();
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: reviewsData, isFetching: isFetchingReviews, error } = useReviewsQuery(selectedTestId!);
  const { data: latestReviewsData, isFetching: isFetchingLatestReviews, error: latestReviewsError } = useTeacherLatestReviews();

  // Use latest reviews when no test is selected, otherwise use test-specific reviews
  const reviews: CombinedReview[] = selectedTestId ? (reviewsData?.reviews ?? []) : (latestReviewsData?.reviews ?? []);
  const isLoading = selectedTestId ? isFetchingReviews : isFetchingLatestReviews;
  const reviewsError = selectedTestId ? error : latestReviewsError;

  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [reviews, currentPage]);

  const handleTestChange = (value: string) => {
    const testId = parseInt(value, 10);
    setSelectedTestId(value === ALL_TESTS || isNaN(testId) ? null : testId);
    setCurrentPage(1);
  };

  const selectedTest = useMemo(() => {
    return tests?.find(t => t.id === selectedTestId);
  }, [tests, selectedTestId]);

  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((acc, r) => acc + r.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.list}>
          {Array.from({ length: 3 }).map((_, i) => <ReviewCardSkeleton key={i} />)}
        </div>
      );
    }

    if (reviewsError) {
      return (
        <TeacherListEmpty
          tone="error"
          icon={<AlertTriangle size={26} />}
          title="Could not load reviews"
          description={reviewsError.message}
        />
      );
    }

    if (paginatedReviews.length === 0) {
      return (
        <TeacherListEmpty
          icon={<MessageSquare size={26} />}
          title="No reviews yet"
          description={
            selectedTestId
              ? 'Nobody has reviewed this test series yet. Reviews appear once students finish a test and rate it.'
              : 'Reviews appear here once students finish one of your tests and rate it.'
          }
        />
      );
    }

    return (
      <div className={styles.list}>
        {paginatedReviews.map(review => (
          <article key={review.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.reviewerLine}>
                <span className={styles.reviewerName}>{review.reviewerName}</span>
                <StarRating rating={review.rating} />
              </div>
              <span className={styles.reviewDate}>
                {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
              </span>
            </div>
            {!selectedTestId && 'mockTestTitle' in review && review.mockTestTitle && (
              <Badge variant="outline">{review.mockTestTitle}</Badge>
            )}
            {review.reviewText ? (
              <p className={styles.reviewText}>{review.reviewText}</p>
            ) : (
              <p className={`${styles.reviewText} ${styles.noText}`}>Rated without a written review.</p>
            )}
          </article>
        ))}
      </div>
    );
  };

  const hasSummary = !isLoading && !reviewsError && reviews.length > 0;

  return (
    <>
      <Helmet>
        <title>Test Reviews - Testkart</title>
        <meta name="description" content="Read and manage reviews for your mock tests." />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Reviews" />

        <TeacherListToolbar>
          <Select onValueChange={handleTestChange} value={selectedTestId?.toString() ?? ALL_TESTS}>
            <SelectTrigger className={teacherToolbarControlClass} aria-label="Filter reviews by test series">
              <SelectValue placeholder="All test series" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TESTS}>All test series</SelectItem>
              {isFetchingTests ? (
                <SelectItem value="loading" disabled>Loading test series...</SelectItem>
              ) : (
                tests?.map(test => (
                  <SelectItem key={test.id} value={test.id.toString()}>
                    {test.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </TeacherListToolbar>

        {hasSummary && (
          <div className={styles.summary}>
            <span className={styles.summaryScope}>
              {selectedTest?.title ?? 'Across all test series'}
            </span>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                <Star size={18} className={styles.statIcon} fill="currentColor" aria-hidden="true" />
                {averageRating.toFixed(1)}
              </span>
              <span className={styles.statLabel}>Average rating</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{reviews.length}</span>
              <span className={styles.statLabel}>
                {reviews.length === 1 ? 'Review' : 'Reviews'}
              </span>
            </div>
          </div>
        )}

        {renderContent()}

        {totalPages > 1 && (
          <TeacherListPagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </>
  );
};

export default TeacherReviewsPage;
