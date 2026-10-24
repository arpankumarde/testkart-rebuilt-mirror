import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookCopy,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Info,
  Star,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { useEnrolledTestsQuery } from '../helpers/useEnrolledTestsQuery';
import { EnrolledTestItemList, EnrolledTestItemRow } from '../components/EnrolledTestItemRow';
import { ReviewDialog } from '../components/ReviewDialog';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { Placeholder } from '../helpers/placeholderImages';
import styles from './student.tests.$enrolledTestId.module.css';

const getScoreColor = (score: number | null): 'success' | 'warning' | 'destructive' | 'default' => {
  if (score === null) return 'default';
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'destructive';
};

export default function StudentTestPackageDetailPage() {
  const { enrolledTestId } = useParams<{ enrolledTestId: string }>();
  const { data, isFetching, error, refetch } = useEnrolledTestsQuery();
  const { authState } = useAuth();
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';

  const enrolledTest = useMemo(() => {
    if (!data?.enrolledTests || !enrolledTestId) return undefined;
    return data.enrolledTests.find((t) => String(t.id) === enrolledTestId);
  }, [data, enrolledTestId]);

  const nextTestItem = useMemo(() => {
    if (!enrolledTest) return undefined;
    const now = new Date();
    return (
      enrolledTest.testItems.find((item) => {
        const isScheduledFuture = item.scheduledDate && new Date(item.scheduledDate) > now;
        return !item.isCompleted && !isScheduledFuture;
      }) || enrolledTest.testItems[0]
    );
  }, [enrolledTest]);

  const continueLearningUrl = nextTestItem ? `/portal/${nextTestItem.id}` : '#';

  if (isFetching) {
    return (
      <div className={styles.page}>
        <Skeleton className={styles.headerSkeleton} />
        <Skeleton className={styles.listSkeleton} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Link to="/student/tests" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to mock tests
        </Link>
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load this test series"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  if (!enrolledTest) {
    return (
      <div className={styles.page}>
        <Link to="/student/tests" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to mock tests
        </Link>
        <ConsoleListEmpty
          icon={<BookCopy size={24} />}
          title="Could not open this test series"
          description="It may have been removed, or it belongs to another account."
        >
          <Button asChild variant="outline">
            <Link to="/student/tests">Go to your mock tests</Link>
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const averageScoreColor = getScoreColor(enrolledTest.averageScore);
  const formattedEnrolledDate = new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(enrolledTest.enrolledAt ?? new Date()));
  const completionPercent = Math.round(enrolledTest.progressPercentage);

  return (
    <>
      <Helmet>
        <title>{enrolledTest.title} | Tests | Testkart</title>
        <meta name="description" content={`Track your progress and access all tests in ${enrolledTest.title}.`} />
      </Helmet>
      <div className={styles.page}>
        <Link to="/student/tests" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to mock tests
        </Link>

        <section className={styles.overview} aria-labelledby="series-title">
          <div className={styles.overviewTop}>
            <div className={styles.thumbnail}>
              <img
                src={enrolledTest.thumbnailUrl || Placeholder.TEST}
                alt=""
                className={styles.thumbnailImage}
              />
            </div>

            <div className={styles.headerContent}>
              {(enrolledTest.examName || !enrolledTest.isPublished) && (
                <div className={styles.headerBadges}>
                  {enrolledTest.examName && <Badge className={styles.examBadge}>{enrolledTest.examName}</Badge>}
                  {!enrolledTest.isPublished && (
                    <Badge variant="outline" className={styles.unpublishedBadge}>
                      <Info size={12} />
                      Unpublished
                    </Badge>
                  )}
                </div>
              )}
              <h1 id="series-title" className={styles.title}>{enrolledTest.title}</h1>
              <p className={styles.metaLine}>
                <span className={styles.metaItem}>
                  <CalendarCheck size={14} aria-hidden="true" />
                  Enrolled {formattedEnrolledDate}
                </span>
                {enrolledTest.creatorName && (
                  <span className={styles.metaItem}>
                    <UserRound size={14} aria-hidden="true" />
                    {enrolledTest.creatorName}
                  </span>
                )}
              </p>
            </div>

            {!isTeacher && (
              <div className={styles.actions}>
                <Link to={continueLearningUrl} className={`${styles.actionButton} ${styles.primaryButton}`}>
                  Continue learning
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link
                  to={`/student/tests/leaderboards?series=${enrolledTest.id}`}
                  className={`${styles.actionButton} ${styles.outlineButton}`}
                >
                  <Trophy size={15} aria-hidden="true" />
                  Leaderboard
                </Link>
                {enrolledTest.completedItems > 0 && !enrolledTest.hasReviewed && (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.ghostButton}`}
                    onClick={() => setIsReviewDialogOpen(true)}
                  >
                    <Star size={15} aria-hidden="true" />
                    Write a review
                  </button>
                )}
              </div>
            )}
          </div>

          <dl className={styles.stats}>
            <div className={styles.progressCell}>
              <div className={styles.progressTopRow}>
                <dt className={styles.statLabel}>Completion</dt>
                <dd className={styles.progressPercent}>{completionPercent}%</dd>
              </div>
              <Progress value={enrolledTest.progressPercentage} className={styles.progressBar} />
            </div>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>
                <BookCopy size={14} aria-hidden="true" />
                Total tests
              </dt>
              <dd className={styles.statValue}>{enrolledTest.totalItems}</dd>
            </div>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>
                <CheckCircle2 size={14} aria-hidden="true" />
                Completed
              </dt>
              <dd className={styles.statValue}>
                {enrolledTest.completedItems}
                <span className={styles.statOf}>/ {enrolledTest.totalItems}</span>
              </dd>
            </div>
            <div className={styles.statCell}>
              <dt className={styles.statLabel}>
                <Target size={14} aria-hidden="true" />
                Average score
              </dt>
              <dd className={`${styles.statValue} ${styles[averageScoreColor]}`}>
                {enrolledTest.averageScore !== null ? `${enrolledTest.averageScore.toFixed(1)}%` : 'Not scored'}
              </dd>
            </div>
          </dl>
        </section>

        <section className={styles.testsPanel} aria-labelledby="series-tests-title">
          <header className={styles.testsHeader}>
            <h2 id="series-tests-title" className={styles.testsTitle}>
              <ClipboardList size={18} aria-hidden="true" />
              Tests in this series
            </h2>
            <span className={styles.testsCount}>
              {enrolledTest.completedItems} of {enrolledTest.totalItems} completed
            </span>
          </header>

          {enrolledTest.testItems.length > 0 ? (
            <EnrolledTestItemList>
              {enrolledTest.testItems.map((item, index) => (
                <EnrolledTestItemRow
                  key={item.id}
                  item={item}
                  index={index + 1}
                  seriesId={enrolledTest.id}
                  isTeacher={isTeacher}
                />
              ))}
            </EnrolledTestItemList>
          ) : (
            <p className={styles.noTests}>The teacher has not added any tests to this series yet.</p>
          )}
        </section>

        <ReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          mockTestId={enrolledTest.id}
          testPackageTitle={enrolledTest.title}
        />
      </div>
    </>
  );
}
