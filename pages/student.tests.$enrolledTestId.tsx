import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookCopy,
  CheckCircle2,
  Info,
  Star,
  Target,
} from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { useEnrolledTestsQuery } from '../helpers/useEnrolledTestsQuery';
import { TestItemRow } from '../components/EnrolledTestCard';
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
        <Skeleton className={styles.itemSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
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

        <div className={styles.headerCard}>
          <div className={styles.cardHeader}>
            <div className={styles.thumbnail}>
              <img
                src={enrolledTest.thumbnailUrl || Placeholder.TEST}
                alt=""
                className={styles.thumbnailImage}
              />
            </div>
            <div className={styles.headerContent}>
              <div className={styles.headerBadges}>
                {enrolledTest.examName && <Badge>{enrolledTest.examName}</Badge>}
                {!enrolledTest.isPublished && (
                  <Badge variant="outline" className={styles.unpublishedBadge}>
                    <Info size={14} />
                    Unpublished
                  </Badge>
                )}
              </div>
              <h1 className={styles.title}>{enrolledTest.title}</h1>
              <p className={styles.enrolledDate}>Enrolled {formattedEnrolledDate}</p>
            </div>
          </div>

          <div className={styles.progressSection}>
            <div className={styles.progressTopRow}>
              <span className={styles.progressLabel}>Progress</span>
              <span className={styles.progressPercent}>{Math.round(enrolledTest.progressPercentage)}%</span>
            </div>
            <Progress value={enrolledTest.progressPercentage} />
            <div className={styles.statStrip}>
              <span className={styles.statChip}>
                <BookCopy size={14} className={styles.statChipIcon} />
                <strong>{enrolledTest.totalItems}</strong> tests
              </span>
              <span className={styles.statDivider} aria-hidden="true">&bull;</span>
              <span className={styles.statChip}>
                <CheckCircle2 size={14} className={styles.statChipIcon} />
                <strong>{enrolledTest.completedItems}</strong> completed
              </span>
              <span className={styles.statDivider} aria-hidden="true">&bull;</span>
              <span className={styles.statChip}>
                <Target size={14} className={styles.statChipIcon} />
                Avg{' '}
                <strong className={styles[averageScoreColor]}>
                  {enrolledTest.averageScore !== null ? `${enrolledTest.averageScore.toFixed(1)}%` : 'Not scored'}
                </strong>
              </span>
            </div>
          </div>

          {!isTeacher && (
            <div className={styles.headerFooter}>
              {enrolledTest.completedItems > 0 && !enrolledTest.hasReviewed && (
                <button className={styles.reviewButton} onClick={() => setIsReviewDialogOpen(true)}>
                  <Star size={14} />
                  Write a review
                </button>
              )}
              <Link to={continueLearningUrl} className={styles.continueButton}>
                Continue learning
              </Link>
            </div>
          )}
        </div>

        <div className={styles.testItemsList}>
          {enrolledTest.testItems.map((item) => (
            <TestItemRow key={item.id} item={item} isTeacher={isTeacher} />
          ))}
        </div>

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
