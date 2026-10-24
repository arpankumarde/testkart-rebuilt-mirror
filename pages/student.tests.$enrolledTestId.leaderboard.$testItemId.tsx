import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookCopy, Clock, Eye, FileQuestion, PlayCircle, Repeat, Trophy } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { useEnrolledTestsQuery } from '../helpers/useEnrolledTestsQuery';
import { TestItemLeaderboard } from '../components/TestItemLeaderboard';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import styles from './student.tests.$enrolledTestId.leaderboard.$testItemId.module.css';

/*
 * One test paper's leaderboard, inside its series: reached from the trophy on
 * a test row of /student/tests/:enrolledTestId and leading back there. The
 * paper must belong to that series, and rankings are fetched by test item id.
 */
export default function StudentTestItemLeaderboardPage() {
  const { enrolledTestId, testItemId } = useParams<{ enrolledTestId: string; testItemId: string }>();
  const { data, isFetching, error, refetch } = useEnrolledTestsQuery();
  const { authState } = useAuth();
  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';

  const series = useMemo(
    () => data?.enrolledTests.find((t) => String(t.id) === enrolledTestId),
    [data, enrolledTestId]
  );
  const item = useMemo(
    () => series?.testItems.find((i) => String(i.id) === testItemId),
    [series, testItemId]
  );
  const seriesUrl = `/student/tests/${enrolledTestId}`;

  if (isFetching && !data) {
    return (
      <div className={styles.page}>
        <Skeleton className={styles.headerSkeleton} />
        <Skeleton className={styles.boardSkeleton} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Link to={seriesUrl} className={styles.backLink}>
          <ArrowLeft size={16} /> Back to test series
        </Link>
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load this leaderboard"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  if (!series || !item) {
    return (
      <div className={styles.page}>
        <Link to={series ? seriesUrl : '/student/tests'} className={styles.backLink}>
          <ArrowLeft size={16} /> {series ? 'Back to test series' : 'Back to mock tests'}
        </Link>
        <ConsoleListEmpty
          icon={<BookCopy size={24} />}
          title="Could not open this leaderboard"
          description="This test is not part of a series you are enrolled in, or it has been removed."
        >
          <Button asChild variant="outline">
            <Link to={series ? seriesUrl : '/student/tests'}>{series ? 'Go to the series' : 'Go to your mock tests'}</Link>
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const isScheduled = !!item.scheduledDate && new Date(item.scheduledDate) > new Date();

  return (
    <>
      <Helmet>
        <title>{`Leaderboard - ${item.title} | Testkart`}</title>
        <meta name="description" content={`Rankings for ${item.title} in ${series.title}.`} />
      </Helmet>
      <div className={styles.page}>
        <Link to={seriesUrl} className={styles.backLink}>
          <ArrowLeft size={16} />
          <span className={styles.backText}>Back to {series.title}</span>
        </Link>

        <header className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Trophy size={20} />
          </span>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>Test leaderboard</span>
            <h1 className={styles.title}>{item.title}</h1>
            <p className={styles.meta}>
              <span className={styles.metaItem}>
                <BookCopy size={14} aria-hidden="true" />
                {series.title}
              </span>
              <span className={styles.metaItem}>
                <Clock size={14} aria-hidden="true" />
                {item.durationMinutes > 0 ? `${item.durationMinutes} min` : 'No time limit'}
              </span>
              <span className={styles.metaItem}>
                <FileQuestion size={14} aria-hidden="true" />
                {item.totalQuestions} Qs
              </span>
            </p>
          </div>
          {!isTeacher && !isScheduled && (
            <div className={styles.headerActions}>
              {item.isCompleted ? (
                <>
                  <Link to={`/portal/${item.id}`} className={styles.secondaryButton}>
                    <Repeat size={15} aria-hidden="true" />
                    Retake
                  </Link>
                  <Link to={`/portal/${item.id}/results`} className={styles.solidButton}>
                    <Eye size={15} aria-hidden="true" />
                    View result
                  </Link>
                </>
              ) : (
                <Link to={`/portal/${item.id}`} className={styles.solidButton}>
                  {item.attemptsCount > 0 ? <Repeat size={15} aria-hidden="true" /> : <PlayCircle size={15} aria-hidden="true" />}
                  {item.attemptsCount > 0 ? 'Retake test' : 'Start test'}
                </Link>
              )}
            </div>
          )}
        </header>

        <TestItemLeaderboard testItemId={item.id} />
      </div>
    </>
  );
}