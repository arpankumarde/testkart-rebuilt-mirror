import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useStudentEnrolledLiveTestsQuery } from '../helpers/useStudentEnrolledLiveTestsQuery';
import { EnrolledLiveTestCard } from '../components/EnrolledLiveTestCard';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { Radio, AlertTriangle } from 'lucide-react';
import styles from './student.live.module.css';

export default function StudentLivePage() {
  const { data, isFetching, error, refetch } = useStudentEnrolledLiveTestsQuery();

  const enrolledLiveTests = data?.enrolledLiveTests ?? [];
  const activeLiveTests = enrolledLiveTests.filter((t) => t.status !== 'ended');
  const endedLiveTests = enrolledLiveTests.filter((t) => t.status === 'ended');

  const renderBody = () => {
    if (isFetching) {
      return (
        <div className={styles.panel}>
          <div className={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className={styles.cardSkeleton} />
            ))}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load your live tests"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (enrolledLiveTests.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Radio size={24} />}
          title="No live tests yet"
          description="Live tests run to a schedule and rank every entrant. Join one and it shows up here."
        >
          <Button asChild>
            <Link to="/mock-test/live">Browse live tests</Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        {activeLiveTests.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Active and upcoming
                <span className={styles.sectionCount}>{activeLiveTests.length}</span>
              </h2>
            </div>
            <div className={styles.grid}>
              {activeLiveTests.map((test) => (
                <EnrolledLiveTestCard key={test.id} test={test} />
              ))}
            </div>
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              Past results
              {endedLiveTests.length > 0 && (
                <span className={styles.sectionCount}>{endedLiveTests.length}</span>
              )}
            </h2>
          </div>
          {endedLiveTests.length === 0 ? (
            <div className={styles.stateBlock}>
              <span className={styles.stateIcon} aria-hidden="true">
                <Radio size={20} />
              </span>
              <h3 className={styles.stateTitle}>No results yet</h3>
              <p className={styles.stateHint}>
                Your rank and score appear here once a live test you entered has ended.
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {endedLiveTests.map((test) => (
                <EnrolledLiveTestCard key={test.id} test={test} />
              ))}
            </div>
          )}
        </section>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Live mock tests | Testkart</title>
        <meta
          name="description"
          content="Track your enrolled live competitive tests and view your past results on Testkart."
        />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Live mock tests">
          <Button asChild variant="outline">
            <Link to="/mock-test/live">Browse live tests</Link>
          </Button>
        </ConsolePageHeader>

        {renderBody()}
      </div>
    </>
  );
}
