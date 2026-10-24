import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Trophy } from 'lucide-react';
import { useStudentLeaderboardsQuery } from '../helpers/useStudentLeaderboardsQuery';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { TestLeaderboard } from '../components/TestLeaderboard';
import { TestLeaderboardDialog } from '../components/TestLeaderboardDialog';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import styles from './student.tests.leaderboards.module.css';

/*
 * Leaderboards for the test series this student may see - enrolled, or at
 * least one attempt. Part of the Mock Tests section, so the sidebar keeps Mock
 * Tests active here. ?series=<id> preselects a series and &test=<id> one of its
 * papers; the Mock Tests list, the enrolled series page header and the public
 * series page link here. A single test's board, opened from a test row, is
 * /student/tests/:enrolledTestId/leaderboard/:testItemId.
 */
export default function StudentTestsLeaderboardsPage() {
  const { data, isFetching, error, refetch } = useStudentLeaderboardsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const series = data?.series ?? [];
  const requestedId = Number(searchParams.get('series'));
  const requestedTestId = Number(searchParams.get('test'));
  const selected = series.find((s) => s.id === requestedId) ?? series[0];

  const selectSeries = (id: number) => {
    setSearchParams({ series: String(id) }, { replace: true });
  };

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.layout}>
          <Skeleton className={styles.listSkeleton} />
          <Skeleton className={styles.panelSkeleton} />
        </div>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load your leaderboards"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!selected) {
      return (
        <ConsoleListEmpty
          icon={<Trophy size={24} />}
          title="No leaderboards yet"
          description="Enrol in a test series or attempt one of its tests, and its leaderboard shows up here."
        >
          <Button asChild>
            <Link to="/mock-test">Browse tests</Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    const items = selected.items;
    const seriesLink =
      selected.access === 'enrolled' ? `/student/tests/${selected.id}` : `/mock-test/${selected.slug}`;

    return (
      <div className={styles.layout}>
        {series.length > 1 && (
          <nav className={styles.seriesList} aria-label="Choose a test series">
            {series.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.seriesButton}
                data-active={s.id === selected.id}
                aria-current={s.id === selected.id ? 'true' : undefined}
                onClick={() => selectSeries(s.id)}
              >
                <span className={styles.seriesTitle}>{s.title}</span>
                {s.examName && <span className={styles.seriesMeta}>{s.examName}</span>}
              </button>
            ))}
          </nav>
        )}

        <section className={styles.panel} aria-labelledby="leaderboard-series-title">
          <header className={styles.panelHeader}>
            <div className={styles.panelHeading}>
              <h2 id="leaderboard-series-title" className={styles.panelTitle}>{selected.title}</h2>
              <div className={styles.panelBadges}>
                <Badge variant={selected.access === 'enrolled' ? 'default' : 'outline'}>
                  {selected.access === 'enrolled' ? 'Enrolled' : 'Attempted'}
                </Badge>
                <span className={styles.panelMeta}>{items.length} {items.length === 1 ? 'test' : 'tests'}</span>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={seriesLink}>View series</Link>
            </Button>
          </header>

          <TestLeaderboard
            key={`${selected.id}-${requestedTestId}`}
            testItems={items}
            initialTestItemId={requestedTestId || undefined}
            onViewFull={() => setIsDialogOpen(true)}
          />
        </section>

        <TestLeaderboardDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          testItems={items}
          defaultTestItemIndex={Math.max(0, items.findIndex((item) => item.id === requestedTestId))}
          packageTitle={selected.title}
        />
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Leaderboards | Testkart</title>
        <meta name="description" content="See your rank, scores and timings in the test series you are enrolled in or have attempted." />
      </Helmet>
      <div className={styles.page}>
        <Link to="/student/tests" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to mock tests
        </Link>
        <ConsolePageHeader title="Leaderboards">
          <Button asChild variant="outline">
            <Link to="/mock-test">Browse tests</Link>
          </Button>
        </ConsolePageHeader>
        {renderContent()}
      </div>
    </>
  );
}