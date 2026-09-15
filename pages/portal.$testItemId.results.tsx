import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useTestResultsQuery } from "../helpers/useTestResultsQuery";
import { useEnrolledTestsQuery } from "../helpers/useEnrolledTestsQuery";
import { Button } from "../components/Button";
import { TestResultsDisplay } from "../components/TestResultsDisplay";
import { Skeleton } from "../components/Skeleton";
import { ReviewDialog } from "../components/ReviewDialog";
import { BRAND_FAVICON } from "../helpers/brandAssets";
import styles from "./portal.$testItemId.results.module.css";

export default function TestResultsPage() {
  const { testItemId: testItemIdStr } = useParams<{ testItemId: string }>();
  const navigate = useNavigate();
  const testItemId = testItemIdStr ? parseInt(testItemIdStr, 10) : undefined;

  const { data, isFetching, error } = useTestResultsQuery(testItemId);
  const { data: enrolledData } = useEnrolledTestsQuery();
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

  const enrolledPackage = enrolledData?.enrolledTests.find(pkg => 
    pkg.testItems.some(item => item.id === testItemId)
  );
  const testItem = enrolledPackage?.testItems.find(item => item.id === testItemId);

  useEffect(() => {
    if (error?.message.includes("No completed attempts")) {
      const timer = setTimeout(() => {
        if (testItemId) {
          navigate(`/portal/${testItemId}`);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error, testItemId, navigate]);

  // Show review dialog when results are successfully loaded
  useEffect(() => {
    if (data && !isFetching && !error && enrolledData) {
            if (enrolledPackage && !enrolledPackage.hasReviewed) {
        setIsReviewDialogOpen(true);
      }
    }
  }, [data, isFetching, error, enrolledData, enrolledPackage]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0m 0s";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const renderContent = () => {
    if (isFetching) {
      return <ResultsSkeleton />;
    }

    if (error) {
      if (error.message.includes("No completed attempts")) {
        return (
          <div className={styles.errorContainer}>
            <h2>No Completed Attempts Found</h2>
            <p>You haven't completed this test yet. Redirecting you to start the test...</p>
          </div>
        );
      }
      return (
        <div className={styles.errorContainer}>
          <h2>Error Loading Results</h2>
          <p>{error.message}</p>
          <Button asChild>
            <Link to="/student/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      );
    }

    if (!data) {
      return (
        <div className={styles.errorContainer}>
          <h2>Results Not Found</h2>
          <p>We couldn't find the results for this test.</p>
        </div>
      );
    }

    return (
      <TestResultsDisplay
        score={data.score}
        totalMarks={data.totalMarks}
        maxPossibleMarks={data.maxPossibleMarks}
        correctAnswers={data.correctAnswers}
        totalQuestions={data.totalQuestions}
        timeTaken={data.timeTaken}
        results={data.results.map(r => ({
          ...r,
          // Ensure questionType is always set for proper rendering (it should always be set for valid questions)
          questionType: r.questionType || 'single_correct_mcq',
        }))} 
        showBackButton={true}
      />
    );
  };

  return (
    <div className={styles.container}>
      {data && (
        <ReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          mockTestId={data.mockTestId}
          testPackageTitle={testItem?.title || data.testPackageTitle}
        />
      )}
      <Helmet>
        <title>Test Results | Testkart</title>
        <meta name="description" content="View your latest test attempt results on Testkart." />
        <link rel="icon" type="image/png" sizes="32x32" href={BRAND_FAVICON} />
        <link rel="icon" type="image/png" sizes="16x16" href={BRAND_FAVICON} />
        <link rel="apple-touch-icon" href={BRAND_FAVICON} />
        <link rel="shortcut icon" href={BRAND_FAVICON} />
      </Helmet>
      {renderContent()}
    </div>
  );
}

const ResultsSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
    {/* Header skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', alignItems: 'center' }}>
      <Skeleton style={{ width: '200px', height: '2.5rem' }} />
      <Skeleton style={{ width: '250px', height: '1.25rem' }} />
    </div>
    
    {/* Score card skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', alignItems: 'center', padding: 'var(--spacing-6)', background: 'var(--card)', borderRadius: 'var(--radius-lg)' }}>
      <Skeleton style={{ width: '150px', height: '1.5rem' }} />
      <Skeleton style={{ width: '200px', height: '4rem' }} />
      <Skeleton style={{ width: '120px', height: '1.5rem' }} />
    </div>
    
    {/* Performance breakdown skeleton */}
    <div style={{ display: 'flex', gap: 'var(--spacing-4)', justifyContent: 'space-around' }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', alignItems: 'center' }}>
          <Skeleton style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-full)' }} />
          <Skeleton style={{ width: '60px', height: '1rem' }} />
        </div>
      ))}
    </div>
    
    {/* Questions skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      <Skeleton style={{ width: '250px', height: '2rem' }} />
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', padding: 'var(--spacing-4)', background: 'var(--card)', borderRadius: 'var(--radius)' }}>
          <Skeleton style={{ width: '80%', height: '1.5rem' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} style={{ width: '100%', height: '2rem' }} />
            ))}
          </div>
          <Skeleton style={{ width: '100%', height: '3rem' }} />
        </div>
      ))}
    </div>
  </div>
);