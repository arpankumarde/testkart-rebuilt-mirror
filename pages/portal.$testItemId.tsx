import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { useEnrolledTestsQuery } from '../helpers/useEnrolledTestsQuery';
import { useQuery } from '@tanstack/react-query';
import { getTestItemDetailsById } from '../endpoints/test-items/details_GET.schema';
import { TestAttemptInterface } from '../components/TestAttemptInterface';
import { Button } from '../components/Button';
import { AlertTriangle, Frown, Lock, Clock } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import styles from './portal.$testItemId.module.css';

// Minimal type for what TestAttemptInterface actually needs
type MinimalTestItem = {
  id: number;
  title: string;
  durationMinutes: number;
  totalQuestions: number;
  scheduledDate?: string | Date | null;
};

const PortalTestAttemptPage: React.FC = () => {
  const { testItemId: testItemIdParam } = useParams<{testItemId: string;}>();

  const testItemId = testItemIdParam ? parseInt(testItemIdParam, 10) : NaN;

  // Check enrolled tests (will be empty/error if unauthenticated)
  const { data: enrolledData, isLoading: isEnrolledLoading } = useEnrolledTestsQuery();

  // Always fetch test item details to check if it's free
  const { data: testItemDetails, isLoading: isDetailsLoading, error: detailsError } = useQuery({
    queryKey: ['testItemDetails', testItemId],
    queryFn: () => getTestItemDetailsById({ testItemId }),
    enabled: !isNaN(testItemId),
  });

  if (isNaN(testItemId)) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Invalid Test ID"
          description="The test ID in the URL is not valid. Please check the link and try again."
        />
        <div className={styles.errorContainer}>
          <AlertTriangle className={styles.errorIcon} />
          <h2>Invalid Test ID</h2>
          <p>The test ID in the URL is not valid. Please check the link and try again.</p>
          <Button asChild>
            <Link to="/student/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isLoading = isEnrolledLoading || isDetailsLoading;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Loading Test..."
          description="Take your mock test and get instant results with detailed analysis"
        />
        <div className={styles.loadingContainer}>
          <Skeleton style={{ width: '6rem', height: '6rem', borderRadius: 'var(--radius-full)' }} />
          <Skeleton style={{ width: '250px', height: '2rem', marginTop: 'var(--spacing-6)' }} />
          <Skeleton style={{ width: '350px', height: '1.25rem', marginTop: 'var(--spacing-2)' }} />
        </div>
      </div>
    );
  }

  if (detailsError) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Error"
          description="There was an error fetching the test details. Please try again later."
        />
        <div className={styles.errorContainer}>
          <Frown className={styles.errorIcon} />
          <h2>Could Not Load Test</h2>
          <p>There was an error fetching the test details. Please try again later.</p>
          <Button asChild>
            <Link to="/student/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  let testItem: MinimalTestItem | undefined;

  const isEnrolled = enrolledData?.enrolledTests.some((pkg) =>
    pkg.testItems.some((item) => item.id === testItemId)
  ) ?? false;

  // Always use testItemDetails as the primary data source, but only grant access if enrolled or free
  if (testItemDetails) {
    const isFree = testItemDetails.item.isFree;

    if (isEnrolled || isFree) {
      testItem = {
        id: testItemDetails.item.id,
        title: testItemDetails.item.title,
        durationMinutes: testItemDetails.item.durationMinutes,
        totalQuestions: testItemDetails.item.totalQuestions,
        scheduledDate: testItemDetails.item.scheduledDate,
      };
    }
  }

  // If item is scheduled for future
  if (testItem && testItem.scheduledDate && new Date(testItem.scheduledDate) > new Date()) {
    const scheduledDate = new Date(testItem.scheduledDate);
    return (
      <div className={styles.container}>
        <SEOHead
          title="Test Not Available"
          description={`This test will be available on ${scheduledDate.toLocaleDateString()}`}
        />
        <div className={styles.errorContainer}>
          <Lock className={styles.errorIcon} />
          <h2>Test Locked</h2>
          <p>This test is not yet available to attempt.</p>
          <div className={styles.scheduledInfo}>
            <Clock size={16} />
            <span>Available on: {scheduledDate.toLocaleString()}</span>
          </div>
          <Button asChild>
            <Link to="/student/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // If still no access, show not enrolled message
  if (!testItem) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Not Enrolled"
          description="You must enroll in this test first before you can attempt it."
        />
        <div className={styles.errorContainer}>
          <AlertTriangle className={styles.errorIcon} />
          <h2>Not Enrolled</h2>
          <p>You must enroll in this test first before you can attempt it.</p>
          <Button asChild>
            <Link to="/student/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Submitting redirects to /portal/:testItemId/results, which also owns the review prompt.
  return (
    <div className={styles.testInterfaceContainer}>
      <SEOHead
        title={testItem.title || "Take Test"}
        description="Take your mock test and get instant results with detailed analysis"
      />
      <TestAttemptInterface
        testItemId={testItem.id}
        testItemTitle={testItem.title}
        durationMinutes={testItem.durationMinutes}
        totalQuestions={testItem.totalQuestions}
        teacherName={testItemDetails?.package.teacherName || 'Unknown Teacher'}
        calculatorEnabled={testItemDetails?.item.calculatorEnabled ?? false}
      />
    </div>
  );
};

export default PortalTestAttemptPage;