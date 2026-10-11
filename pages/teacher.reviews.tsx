import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { useReviewsQuery } from '../helpers/useReviewsQuery';
import { useTeacherLatestReviews } from '../helpers/useTeacherLatestReviews';
import type { LatestReview } from '../endpoints/teacher/reviews/latest_GET.schema';
import type { OutputType as ReviewListOutput } from '../endpoints/reviews/list_GET.schema';
import { Button } from '../components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherListPagination } from '../components/TeacherListPagination';
import {
  Star,
  MessageSquare,
  MessageSquareText,
  AlertTriangle,
  ThumbsUp,
  CalendarClock,
  ClipboardList,
  SearchX,
} from 'lucide-react';
import styles from './teacher.reviews.module.css';

const ALL_TESTS = 'all';
const ALL_RATINGS = 'all';
const RATING_VALUES = [5, 4, 3, 2, 1] as const;

/* endpoints/teacher/reviews/latest_GET returns at most this many, newest first. */
const LATEST_REVIEWS_LIMIT = 10;

const REVIEWS_PER_PAGE = 5;

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  highest: 'Highest rated',
  lowest: 'Lowest rated',
};

type TestReview = ReviewListOutput['reviews'][number];
type CombinedReview = LatestReview | TestReview;

const AVATAR_TONES = [styles.toneLavender, styles.toneSage, styles.toneBlue, styles.tonePeach];

const toneFor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
};

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (words[0][0] + last).toUpperCase();
};

const formatDate = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

const timeOf = (review: CombinedReview) => (review.createdAt ? new Date(review.createdAt).getTime() : 0);

const pluralise = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/* Two stacked rows of stars; the filled row is clipped to the rating so 4.3 shows 4.3 stars. */
const StarRating = ({ rating, size = 16, className }: { rating: number; size?: number; className?: string }) => {
  const percent = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span
      className={`${styles.stars} ${className ?? ''}`}
      role="img"
      aria-label={`Rated ${Number.isInteger(rating) ? rating : rating.toFixed(1)} out of 5`}
    >
      <span className={styles.starRow} aria-hidden="true">
        {RATING_VALUES.map((v) => (
          <Star key={v} size={size} className={styles.emptyStar} />
        ))}
      </span>
      <span className={`${styles.starRow} ${styles.starFill}`} style={{ width: `${percent}%` }} aria-hidden="true">
        {RATING_VALUES.map((v) => (
          <Star key={v} size={size} className={styles.filledStar} />
        ))}
      </span>
    </span>
  );
};

const OverviewSkeleton = () => (
  <section className={styles.overview} aria-hidden="true">
    <div className={styles.ratingCard}>
      <Skeleton style={{ height: '0.875rem', width: '8rem' }} />
      <Skeleton style={{ height: '3rem', width: '6rem' }} />
      <Skeleton style={{ height: '1.25rem', width: '9rem' }} />
    </div>
    <div className={styles.distribution}>
      {RATING_VALUES.map((v) => (
        <Skeleton key={v} style={{ height: '0.75rem', width: '100%' }} />
      ))}
    </div>
    <div className={styles.stats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: '3.5rem', width: '100%' }} />
      ))}
    </div>
  </section>
);

const ReviewCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.reviewer}>
        <Skeleton style={{ height: '2.25rem', width: '2.25rem', borderRadius: '9999px', flexShrink: 0 }} />
        <div className={styles.reviewerText}>
          <Skeleton style={{ height: '1rem', width: '9rem' }} />
          <Skeleton style={{ height: '0.875rem', width: '6rem' }} />
        </div>
      </div>
      <Skeleton style={{ height: '0.875rem', width: '5rem' }} />
    </div>
    <Skeleton style={{ height: '1.5rem', width: '14rem', maxWidth: '100%' }} />
    <Skeleton style={{ height: '0.875rem', width: '80%' }} />
  </div>
);

const TeacherReviewsPage: React.FC = () => {
  const { data: tests, isFetching: isFetchingTests } = useTeacherTestsQuery();
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: reviewsData, isFetching: isFetchingReviews, error } = useReviewsQuery(selectedTestId!);
  const { data: latestReviewsData, isFetching: isFetchingLatestReviews, error: latestReviewsError } = useTeacherLatestReviews();

  // Use latest reviews when no test is selected, otherwise use test-specific reviews
  const reviews: CombinedReview[] = useMemo(
    () => (selectedTestId ? (reviewsData?.reviews ?? []) : (latestReviewsData?.reviews ?? [])),
    [selectedTestId, reviewsData, latestReviewsData]
  );
  const isLoading = selectedTestId ? isFetchingReviews : isFetchingLatestReviews;
  const reviewsError = selectedTestId ? error : latestReviewsError;

  const selectedTest = useMemo(() => {
    return tests?.find(t => t.id === selectedTestId);
  }, [tests, selectedTestId]);

  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((acc, r) => acc + r.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  const distribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[star] += 1;
    }
    return counts;
  }, [reviews]);

  const writtenCount = useMemo(() => reviews.filter((r) => r.reviewText?.trim()).length, [reviews]);
  const positiveShare = reviews.length ? Math.round(((distribution[4] + distribution[5]) / reviews.length) * 100) : 0;
  const latestDate = useMemo(
    () => reviews.reduce<CombinedReview | null>((latest, r) => (!latest || timeOf(r) > timeOf(latest) ? r : latest), null)?.createdAt ?? null,
    [reviews]
  );

  const visibleReviews = useMemo(() => {
    const filtered = ratingFilter ? reviews.filter((r) => Math.round(r.rating) === ratingFilter) : reviews;
    const sorted = [...filtered];
    if (sortKey === 'newest') sorted.sort((a, b) => timeOf(b) - timeOf(a));
    else if (sortKey === 'oldest') sorted.sort((a, b) => timeOf(a) - timeOf(b));
    else if (sortKey === 'highest') sorted.sort((a, b) => b.rating - a.rating || timeOf(b) - timeOf(a));
    else sorted.sort((a, b) => a.rating - b.rating || timeOf(b) - timeOf(a));
    return sorted;
  }, [reviews, ratingFilter, sortKey]);

  const totalPages = Math.ceil(visibleReviews.length / REVIEWS_PER_PAGE);
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
    return visibleReviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [visibleReviews, currentPage]);

  const handleTestChange = (value: string) => {
    const testId = parseInt(value, 10);
    setSelectedTestId(value === ALL_TESTS || isNaN(testId) ? null : testId);
    setRatingFilter(null);
    setCurrentPage(1);
  };

  const handleRatingChange = (value: string) => {
    setRatingFilter(value === ALL_RATINGS ? null : Number(value));
    setCurrentPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortKey(value as SortKey);
    setCurrentPage(1);
  };

  const scopeLabel = selectedTestId
    ? (selectedTest?.title ?? 'This test series')
    : reviews.length >= LATEST_REVIEWS_LIMIT
      ? `Your ${LATEST_REVIEWS_LIMIT} most recent reviews`
      : 'Across all test series';

  const seriesTitleFor = (review: CombinedReview) =>
    'mockTestTitle' in review ? review.mockTestTitle : (selectedTest?.title ?? null);

  const hasReviews = !isLoading && !reviewsError && reviews.length > 0;

  const renderOverview = () => {
    if (isLoading) return <OverviewSkeleton />;
    if (!hasReviews) return null;

    return (
      <section className={styles.overview} aria-label="Rating overview">
        <div className={styles.ratingCard}>
          <span className={styles.scope} title={scopeLabel}>{scopeLabel}</span>
          <div className={styles.ratingValueRow}>
            <span className={styles.ratingValue}>{averageRating.toFixed(1)}</span>
            <span className={styles.ratingOutOf}>out of 5</span>
          </div>
          <StarRating rating={averageRating} size={22} className={styles.ratingStars} />
          <span className={styles.ratingBasis}>Based on {pluralise(reviews.length, 'review', 'reviews')}</span>
        </div>

        <div className={styles.distribution} aria-label="Rating distribution">
          <h2 className={styles.sectionLabel}>Rating breakdown</h2>
          <ul className={styles.barList}>
            {RATING_VALUES.map((star) => {
              const count = distribution[star];
              const share = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
              return (
                <li key={star} className={styles.barRow}>
                  <span className={styles.barLabel}>
                    {star}
                    <Star size={12} className={styles.filledStar} aria-hidden="true" />
                  </span>
                  <span
                    className={styles.barTrack}
                    role="img"
                    aria-label={`${star} star: ${pluralise(count, 'review', 'reviews')}, ${share}%`}
                  >
                    <span className={styles.barFill} style={{ width: `${share}%` }} />
                  </span>
                  <span className={styles.barCount}>{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={`${styles.statIcon} ${styles.toneLavender}`} aria-hidden="true">
              <MessageSquareText size={16} />
            </span>
            <div className={styles.statText}>
              <span className={styles.statValue}>{writtenCount}</span>
              <span className={styles.statLabel}>With written feedback</span>
            </div>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statIcon} ${styles.toneSage}`} aria-hidden="true">
              <ThumbsUp size={16} />
            </span>
            <div className={styles.statText}>
              <span className={styles.statValue}>{positiveShare}%</span>
              <span className={styles.statLabel}>Rated 4 stars or more</span>
            </div>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statIcon} ${styles.toneBlue}`} aria-hidden="true">
              <CalendarClock size={16} />
            </span>
            <div className={styles.statText}>
              <span className={styles.statValue}>{formatDate(latestDate) || '-'}</span>
              <span className={styles.statLabel}>Latest review</span>
            </div>
          </div>
        </div>
      </section>
    );
  };

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

    if (reviews.length === 0) {
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

    if (visibleReviews.length === 0) {
      return (
        <TeacherListEmpty
          icon={<SearchX size={26} />}
          title={`No ${ratingFilter}-star reviews`}
          description="None of the reviews shown here have this rating."
        >
          <Button variant="outline" onClick={() => handleRatingChange(ALL_RATINGS)}>
            Show all ratings
          </Button>
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.list}>
        {paginatedReviews.map(review => {
          const seriesTitle = seriesTitleFor(review);
          const testItemTitle = 'testItemTitle' in review ? review.testItemTitle : null;
          const avatarUrl = 'reviewerAvatarUrl' in review ? review.reviewerAvatarUrl : null;
          const text = review.reviewText?.trim();
          return (
            <article key={review.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.reviewer}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={styles.avatar} width={36} height={36} loading="lazy" />
                  ) : (
                    <span className={`${styles.avatar} ${toneFor(review.reviewerName)}`} aria-hidden="true">
                      {initials(review.reviewerName)}
                    </span>
                  )}
                  <div className={styles.reviewerText}>
                    <span className={styles.reviewerName}>{review.reviewerName}</span>
                    <StarRating rating={review.rating} size={15} />
                  </div>
                </div>
                <time
                  className={styles.reviewDate}
                  dateTime={review.createdAt ? new Date(review.createdAt).toISOString() : undefined}
                >
                  {formatDate(review.createdAt)}
                </time>
              </div>

              {(seriesTitle || testItemTitle) && (
                <div className={styles.meta}>
                  <ClipboardList size={14} className={styles.metaIcon} aria-hidden="true" />
                  {seriesTitle && <span className={styles.metaTitle} title={seriesTitle}>{seriesTitle}</span>}
                  {testItemTitle && (
                    <span className={styles.metaItem} title={testItemTitle}>{testItemTitle}</span>
                  )}
                </div>
              )}

              {text ? (
                <p className={styles.reviewText}>{review.reviewText}</p>
              ) : (
                <p className={styles.noText}>Rated without a written review.</p>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  const firstShown = visibleReviews.length ? (currentPage - 1) * REVIEWS_PER_PAGE + 1 : 0;
  const lastShown = Math.min(currentPage * REVIEWS_PER_PAGE, visibleReviews.length);

  return (
    <>
      <Helmet>
        <title>Test Reviews - Testkart</title>
        <meta name="description" content="Read and manage reviews for your mock tests." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Reviews</h1>
            <p className={styles.subtitle}>See what students think about your test series.</p>
          </div>
          <Select onValueChange={handleTestChange} value={selectedTestId?.toString() ?? ALL_TESTS}>
            <SelectTrigger className={`${styles.control} ${styles.seriesControl}`} aria-label="Filter reviews by test series">
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
        </header>

        {renderOverview()}

        {hasReviews && (
          <div className={styles.toolbar}>
            <span className={styles.toolbarCount} aria-live="polite">
              {visibleReviews.length === 0
                ? 'No matching reviews'
                : totalPages > 1
                  ? `Showing ${firstShown}-${lastShown} of ${visibleReviews.length} reviews`
                  : pluralise(visibleReviews.length, 'review', 'reviews')}
            </span>
            <div className={styles.toolbarControls}>
              <Select onValueChange={handleRatingChange} value={ratingFilter?.toString() ?? ALL_RATINGS}>
                <SelectTrigger className={styles.control} aria-label="Filter reviews by star rating">
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_RATINGS}>All ratings</SelectItem>
                  {RATING_VALUES.map((star) => (
                    <SelectItem key={star} value={star.toString()}>
                      {star} {star === 1 ? 'star' : 'stars'} ({distribution[star]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={handleSortChange} value={sortKey}>
                <SelectTrigger className={styles.control} aria-label="Sort reviews">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>{SORT_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
