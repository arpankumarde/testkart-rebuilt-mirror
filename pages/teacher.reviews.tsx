import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Star, MessageSquare, MessageSquareReply, AlertTriangle, ThumbsUp, CalendarClock, SearchX } from 'lucide-react';
import { useTeacherReviews, useReplyToReview } from '../helpers/useTeacherReviews';
import type { ReviewSort, TeacherReview } from '../endpoints/teacher/reviews/list_GET.schema';
import { REVIEW_REPLY_MAX } from '../endpoints/teacher/reviews/reply_POST.schema';
import { teacherContentKind } from '../helpers/teacherContentKinds';
import { Button } from '../components/Button';
import { Textarea } from '../components/Textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { TeacherKindTile } from '../components/TeacherKindTile';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherListPagination } from '../components/TeacherListPagination';
import { ConsoleConfirmDialog } from '../components/ConsoleConfirmDialog';
import styles from './teacher.reviews.module.css';

const ALL = 'all';
const RATING_VALUES = [5, 4, 3, 2, 1] as const;

type ReplyFilter = 'all' | 'unreplied' | 'replied';

const SORT_LABELS: Record<ReviewSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  highest: 'Highest rated',
  lowest: 'Lowest rated',
};

const REPLY_LABELS: Record<ReplyFilter, string> = {
  all: 'All reviews',
  unreplied: 'Waiting for my reply',
  replied: 'Replied',
};

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
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

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

/** The teacher's public answer under one review: shown, written or edited in place. */
const ReplyBlock = ({ review }: { review: TeacherReview }) => {
  const reply = useReplyToReview();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.teacherReply ?? '');
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(review.teacherReply ?? '');
  }, [review.teacherReply, editing]);

  const save = () => {
    const text = draft.trim();
    if (!text) return;
    reply.mutate({ reviewId: review.id, reply: text }, { onSuccess: () => setEditing(false) });
  };

  if (editing) {
    return (
      <div className={styles.replyEditor}>
        <label className={styles.replyLabel} htmlFor={`reply-${review.id}`}>
          Your public reply
        </label>
        <Textarea
          id={`reply-${review.id}`}
          value={draft}
          autoFocus
          rows={3}
          maxLength={REVIEW_REPLY_MAX}
          placeholder="Thank them, answer their question, or say what you are changing."
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className={styles.replyActions}>
          <span className={styles.replyCount}>
            {draft.length} / {REVIEW_REPLY_MAX}
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={reply.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={reply.isPending || !draft.trim()}>
            {reply.isPending ? 'Posting' : review.teacherReply ? 'Save reply' : 'Post reply'}
          </Button>
        </div>
      </div>
    );
  }

  if (review.teacherReply) {
    return (
      <div className={styles.reply}>
        <div className={styles.replyHead}>
          <span className={styles.replyTitle}>Your reply</span>
          {review.teacherRepliedAt && <span className={styles.replyDate}>{formatDate(review.teacherRepliedAt)}</span>}
        </div>
        <p className={styles.replyText}>{review.teacherReply}</p>
        <div className={styles.replyLinks}>
          <button type="button" className={styles.linkButton} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className={styles.linkButton} onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        </div>
        <ConsoleConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          tone="destructive"
          title="Remove your reply?"
          description="Students will no longer see it under this review."
          confirmLabel="Remove reply"
          pendingLabel="Removing"
          isPending={reply.isPending}
          onConfirm={() =>
            reply.mutate({ reviewId: review.id, reply: null }, { onSettled: () => setConfirmRemove(false) })
          }
        />
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" className={styles.replyButton} onClick={() => setEditing(true)}>
      <MessageSquareReply size={15} aria-hidden="true" />
      Reply
    </Button>
  );
};

const TeacherReviewsPage: React.FC = () => {
  const [scope, setScope] = useState<string>(ALL);
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [replied, setReplied] = useState<ReplyFilter>('all');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [page, setPage] = useState(1);

  const [scopeKind, scopeId] = scope === ALL ? [undefined, undefined] : scope.split(':');
  const { data, isFetching, isPending, error } = useTeacherReviews({
    kind: scopeKind as TeacherReview['kind'] | undefined,
    itemId: scopeId ? Number(scopeId) : undefined,
    rating,
    replied,
    sort,
    page,
  });

  const resetPage = () => setPage(1);
  const summary = data?.summary;
  const items = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const scopeItem = items.find((item) => `${item.kind}:${item.id}` === scope);
  const hasAnyReviews = (summary?.count ?? 0) > 0 || items.length > 0;
  const positiveShare = summary && summary.count ? Math.round(((summary.distribution[4] + summary.distribution[5]) / summary.count) * 100) : 0;

  const renderOverview = () => {
    if (isPending) {
      return (
        <section className={styles.overview} aria-hidden="true">
          <Skeleton style={{ height: '9rem', width: '100%' }} />
        </section>
      );
    }
    if (!summary || summary.count === 0) return null;

    return (
      <section className={styles.overview} aria-label="Rating overview">
        <div className={styles.ratingCard}>
          <span className={styles.scope} title={scopeItem?.title}>
            {scopeItem ? scopeItem.title : 'Across everything you sell'}
          </span>
          <div className={styles.ratingValueRow}>
            <span className={styles.ratingValue}>{summary.average.toFixed(1)}</span>
            <span className={styles.ratingOutOf}>out of 5</span>
          </div>
          <StarRating rating={summary.average} size={22} className={styles.ratingStars} />
          <span className={styles.ratingBasis}>Based on {pluralise(summary.count, 'review', 'reviews')}</span>
        </div>

        <div className={styles.distribution} aria-label="Rating distribution">
          <h2 className={styles.sectionLabel}>Rating breakdown</h2>
          <ul className={styles.barList}>
            {RATING_VALUES.map((star) => {
              const count = summary.distribution[star];
              const share = summary.count ? Math.round((count / summary.count) * 100) : 0;
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
          <button
            type="button"
            className={`${styles.stat} ${styles.statButton}`}
            onClick={() => {
              setReplied('unreplied');
              resetPage();
            }}
            disabled={summary.unreplied === 0}
          >
            <span className={`${styles.statIcon} ${styles.tonePeach}`} aria-hidden="true">
              <MessageSquareReply size={16} />
            </span>
            <span className={styles.statText}>
              <span className={styles.statValue}>{summary.unreplied}</span>
              <span className={styles.statLabel}>Written reviews waiting for your reply</span>
            </span>
          </button>
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
              <span className={styles.statValue}>{formatDate(summary.latestAt) || '-'}</span>
              <span className={styles.statLabel}>Latest review</span>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderContent = () => {
    if (isPending) {
      return (
        <div className={styles.list}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: '8rem', width: '100%', borderRadius: '1rem' }} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <TeacherListEmpty
          tone="error"
          icon={<AlertTriangle size={26} />}
          title="Your reviews could not be loaded"
          description={error instanceof Error ? error.message : 'Check your connection and try again.'}
        />
      );
    }

    if (!hasAnyReviews) {
      return (
        <TeacherListEmpty
          icon={<MessageSquare size={26} />}
          title="No reviews yet"
          description="Students can review your test series, courses and notes once they have used them. Reviews show up here, and you can reply to each one."
        />
      );
    }

    if (!data || data.reviews.length === 0) {
      return (
        <TeacherListEmpty
          icon={<SearchX size={26} />}
          title={replied === 'unreplied' ? 'Nothing waiting for a reply' : 'No reviews match these filters'}
          description={replied === 'unreplied' ? 'You have answered every written review here.' : 'Try another rating or listing.'}
        >
          <Button
            variant="outline"
            onClick={() => {
              setRating(undefined);
              setReplied('all');
              resetPage();
            }}
          >
            Show all reviews
          </Button>
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.list}>
        {data.reviews.map((review) => {
          const text = review.reviewText?.trim();
          return (
            <article key={review.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.reviewer}>
                  {review.reviewerAvatarUrl ? (
                    <img src={review.reviewerAvatarUrl} alt="" className={styles.avatar} width={36} height={36} loading="lazy" />
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
                <time className={styles.reviewDate} dateTime={review.createdAt ? new Date(review.createdAt).toISOString() : undefined}>
                  {formatDate(review.createdAt)}
                </time>
              </div>

              <div className={styles.meta}>
                <TeacherKindTile kind={review.kind} size="sm" />
                <span className={styles.metaTitle} title={review.itemTitle}>
                  {review.itemTitle}
                </span>
                {review.testItemTitle && (
                  <span className={styles.metaItem} title={review.testItemTitle}>
                    {review.testItemTitle}
                  </span>
                )}
              </div>

              {text ? (
                <p className={styles.reviewText}>{review.reviewText}</p>
              ) : (
                <p className={styles.noText}>Rated without a written review.</p>
              )}

              <ReplyBlock review={review} />
            </article>
          );
        })}
      </div>
    );
  };

  const firstShown = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastShown = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <>
      <Helmet>
        <title>Reviews - Testkart for Teachers</title>
        <meta name="description" content="Read and reply to reviews of your test series, courses and notes." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Reviews</h1>
            <p className={styles.subtitle}>What students say about your test series, courses and notes. Your replies are public.</p>
          </div>
          <Select
            value={scope}
            onValueChange={(value) => {
              setScope(value);
              setRating(undefined);
              resetPage();
            }}
          >
            <SelectTrigger className={`${styles.control} ${styles.seriesControl}`} aria-label="Filter reviews by listing">
              <SelectValue placeholder="Everything you sell" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everything you sell</SelectItem>
              {(['mock_test', 'course', 'digital_product'] as const).map((kind) => {
                const ofKind = items.filter((item) => item.kind === kind);
                if (ofKind.length === 0) return null;
                return (
                  <SelectGroup key={kind}>
                    <SelectLabel>{teacherContentKind(kind).plural}</SelectLabel>
                    {ofKind.map((item) => (
                      <SelectItem key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                        {item.title} ({item.count})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </header>

        {renderOverview()}

        {hasAnyReviews && !error && (
          <div className={styles.toolbar}>
            <span className={styles.toolbarCount} aria-live="polite">
              {!data || data.total === 0
                ? 'No matching reviews'
                : totalPages > 1
                  ? `Showing ${firstShown}-${lastShown} of ${data.total} reviews`
                  : pluralise(data.total, 'review', 'reviews')}
              {isFetching && !isPending ? ' (updating)' : ''}
            </span>
            <div className={styles.toolbarControls}>
              <Select
                value={replied}
                onValueChange={(value) => {
                  setReplied(value as ReplyFilter);
                  resetPage();
                }}
              >
                <SelectTrigger className={styles.control} aria-label="Filter by reply">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REPLY_LABELS) as ReplyFilter[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {REPLY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={rating?.toString() ?? ALL}
                onValueChange={(value) => {
                  setRating(value === ALL ? undefined : Number(value));
                  resetPage();
                }}
              >
                <SelectTrigger className={styles.control} aria-label="Filter reviews by star rating">
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All ratings</SelectItem>
                  {RATING_VALUES.map((star) => (
                    <SelectItem key={star} value={star.toString()}>
                      {star} {star === 1 ? 'star' : 'stars'} ({summary?.distribution[star] ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sort}
                onValueChange={(value) => {
                  setSort(value as ReviewSort);
                  resetPage();
                }}
              >
                <SelectTrigger className={styles.control} aria-label="Sort reviews">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as ReviewSort[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SORT_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {renderContent()}

        {totalPages > 1 && <TeacherListPagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </div>
    </>
  );
};

export default TeacherReviewsPage;
