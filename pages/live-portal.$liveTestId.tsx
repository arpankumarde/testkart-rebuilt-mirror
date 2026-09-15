import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { useQuery } from '@tanstack/react-query';
import { getLiveTestsDetails } from '../endpoints/live-tests/details_GET.schema';
import { getLiveTestStatus } from '../helpers/useLiveTestHelpers';
import { LiveTestInterface } from '../components/LiveTestInterface';
import { Button } from '../components/Button';
import { AlertTriangle, Frown, Clock, Lock } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import styles from './live-portal.$liveTestId.module.css';

const LivePortalPage: React.FC = () => {
  const { liveTestId: liveTestIdParam } = useParams<{ liveTestId: string }>();
  const liveTestId = liveTestIdParam ? parseInt(liveTestIdParam, 10) : NaN;

  const { data: liveTestDetails, isLoading, error: detailsError } = useQuery({
    queryKey: ['liveTestDetails', liveTestId],
    queryFn: () => getLiveTestsDetails({ id: liveTestId }),
    enabled: !isNaN(liveTestId),
  });

  if (isNaN(liveTestId)) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Invalid Live Test ID"
          description="Join live test and compete in real-time"
        />
        <div className={styles.errorContainer}>
          <AlertTriangle className={styles.errorIcon} />
          <h2>Invalid Live Test ID</h2>
          <p>The live test ID in the URL is not valid. Please check the link and try again.</p>
          <Button asChild>
            <Link to="/mock-test/live">View Live Tests</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Loading Live Test..."
          description="Join live test and compete in real-time"
        />
        <div className={styles.loadingContainer}>
          <Skeleton style={{ width: '6rem', height: '6rem', borderRadius: 'var(--radius-full)' }} />
          <Skeleton style={{ width: '250px', height: '2rem', marginTop: 'var(--spacing-6)' }} />
          <Skeleton style={{ width: '350px', height: '1.25rem', marginTop: 'var(--spacing-2)' }} />
        </div>
      </div>
    );
  }

  if (detailsError || !liveTestDetails) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Error"
          description="There was an error fetching the test details. Please try again later."
        />
        <div className={styles.errorContainer}>
          <Frown className={styles.errorIcon} />
          <h2>Could Not Load Live Test</h2>
          <p>There was an error fetching the test details, or the test does not exist. Please try again later.</p>
          <Button asChild>
            <Link to="/mock-test/live">View Live Tests</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!liveTestDetails.isEnrolled) {
    return (
      <div className={styles.container}>
        <SEOHead
          title="Not Enrolled"
          description="You must be enrolled in this live test to participate."
        />
        <div className={styles.errorContainer}>
          <Lock className={styles.errorIcon} />
          <h2>Not Enrolled</h2>
          <p>You must be enrolled in this live test to participate.</p>
          <Button asChild>
            <Link to={`/mock-test/live/${liveTestId}`}>View Test Details</Link>
          </Button>
        </div>
      </div>
    );
  }

  const status = getLiveTestStatus(liveTestDetails);

  if (status !== 'live') {
    const message = status === 'upcoming'
      ? "This live test has not started yet. Please come back at the scheduled start time."
      : "This live test has already ended.";
    
    return (
      <div className={styles.container}>
        <SEOHead
          title="Test Not Active"
          description="Join live test and compete in real-time"
        />
        <div className={styles.errorContainer}>
          <Clock className={styles.errorIcon} />
          <h2>Test Not Active</h2>
          <p>{message}</p>
          <Button asChild>
            <Link to="/mock-test/live">View Other Live Tests</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.testInterfaceContainer}>
      <SEOHead
        title={liveTestDetails.title || "Live Test"}
                description="Join live test and compete in real-time"
        image={liveTestDetails.thumbnailUrl ?? undefined}
      />
      <LiveTestInterface
        liveTestId={liveTestId}
        liveTestTitle={liveTestDetails.title}
        testItemId={liveTestDetails.mockTestDetails.firstTestItemId}
        durationMinutes={liveTestDetails.mockTestDetails.durationMinutes}
        totalQuestions={liveTestDetails.mockTestDetails.totalQuestions}
        teacherName={liveTestDetails.teacherProfile.name}
      />
    </div>
  );
};

export default LivePortalPage;