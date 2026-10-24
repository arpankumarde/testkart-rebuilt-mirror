import React, { useEffect, useRef, useState } from 'react';
import { isLeaderboardLocked, useTestLeaderboardQuery } from '../helpers/useTestLeaderboardQuery';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { Trophy, BarChart2, Lock } from 'lucide-react';
import styles from './TestLeaderboard.module.css';

/*
 * Top five of one series' papers, for a viewer the server has already let in
 * (see helpers/testSeriesLeaderboardAccess). The public series page does not
 * render this - it shows TestLeaderboardCta instead.
 */
interface TestLeaderboardProps {
  testItems: Array<{ id: number; title: string }>;
  /* Paper whose tab opens first; falls back to the first paper. */
  initialTestItemId?: number;
  onViewFull: () => void;
  className?: string;
}

const LeaderboardSkeleton: React.FC = () => (
  <div className={styles.skeletonContainer}>
    {[...Array(5)].map((_, i) => (
      <div key={i} className={styles.skeletonRow}>
        <Skeleton className={styles.skeletonRank} />
        <Skeleton className={styles.skeletonName} />
        <Skeleton className={styles.skeletonScore} />
        <Skeleton className={styles.skeletonTime} />
      </div>
    ))}
  </div>
);

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);
  const months = Math.round(days / 30.44);
  const years = Math.round(days / 365.25);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
};

export const TestLeaderboard: React.FC<TestLeaderboardProps> = ({
  testItems,
  initialTestItemId,
  onViewFull,
  className,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(0, testItems.findIndex((item) => item.id === initialTestItemId))
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // A preselected paper can sit past the edge of the scrolling tab strip.
  useEffect(() => {
    if (!initialTestItemId) return;
    const tab = containerRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    const strip = tab?.parentElement;
    if (tab && strip) strip.scrollLeft = tab.offsetLeft - strip.offsetLeft - 16;
  }, [initialTestItemId]);

  const selectedTestItem = testItems[selectedIndex];
  const { data, isFetching, error } = useTestLeaderboardQuery(
    selectedTestItem?.id
  );

  const currentUserRank = data?.currentUserBestRank?.rank ?? null;

  const renderRankIcon = (rank: number) => {
    if (rank === 1)
      return <Trophy size={20} className={styles.goldTrophy} />;
    if (rank === 2)
      return <Trophy size={20} className={styles.silverTrophy} />;
    if (rank === 3)
      return <Trophy size={20} className={styles.bronzeTrophy} />;
    return <span className={styles.rankNumber}>{rank}</span>;
  };

  const renderContent = () => {
    if (isFetching && !data) {
      return <LeaderboardSkeleton />;
    }

    if (isLeaderboardLocked(error)) {
      return (
        <div className={styles.emptyState}>
          <Lock size={40} />
          <h3>Leaderboard locked</h3>
          <p>{(error as Error).message}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorState}>
          Failed to load leaderboard. Please try again later.
        </div>
      );
    }

    if (!data || data.leaderboard.length === 0) {
      return (
        <div className={styles.emptyState}>
          <BarChart2 size={48} />
          <h3>No Attempts Yet</h3>
          <p>Be the first to complete this test and claim the top spot!</p>
        </div>
      );
    }

    const topFive = data.leaderboard.slice(0, 5);
    const yourEntry = data.currentUserBestRank;

    return (
      <>
        {yourEntry && (
          <div className={styles.yourRank}>
            <span className={styles.yourRankLabel}>Your best</span>
            <span className={styles.yourRankValue}>Rank #{yourEntry.rank}</span>
            <span className={styles.yourRankMeta}>
              {yourEntry.score.toFixed(2)}% - {yourEntry.timeTaken} min - Attempt {yourEntry.attemptNumber}
            </span>
          </div>
        )}
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <div className={styles.headerCellRank}>Rank</div>
            <div className={styles.headerCellName}>Student</div>
            <div className={styles.headerCellScore}>Score %</div>
            <div className={styles.headerCellTime}>Time</div>
            <div className={styles.headerCellDate}>Completed</div>
          </div>
          <div className={styles.tableBody}>
            {topFive.map((entry) => {
              const isCurrentUser = entry.rank === currentUserRank;
              return (
                <div
                  key={entry.rank}
                  className={`${styles.tableRow} ${isCurrentUser ? styles.currentUserRow : ''}`}
                  data-is-current={isCurrentUser}
                >
                  <div className={styles.cellRank} data-label="Rank">
                    {renderRankIcon(entry.rank)}
                  </div>
                  <div className={styles.cellName} data-label="Student">
                    {entry.studentName}
                    {isCurrentUser && <span className={styles.youTag}>You</span>}
                    <span className={styles.attemptBadge}>
                      Attempt {entry.attemptNumber}
                    </span>
                  </div>
                  <div className={styles.cellScore} data-label="Score">
                    {entry.score.toFixed(2)}
                  </div>
                  <div className={styles.cellTime} data-label="Time">
                    {entry.timeTaken} min
                  </div>
                  <div className={styles.cellDate} data-label="Completed">
                    {formatRelativeTime(entry.completedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.footer}>
          <Button onClick={onViewFull}>View Full Leaderboard</Button>
        </div>
      </>
    );
  };

  if (!testItems || testItems.length === 0) {
    return (
      <div className={styles.errorState}>
        No test items available.
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ''}`}>
      {testItems.length === 1 ? (
        <div className={styles.contentWrapper}>{renderContent()}</div>
      ) : (
        <Tabs
          value={selectedIndex.toString()}
          onValueChange={(value) => setSelectedIndex(parseInt(value, 10))}
        >
          <TabsList className={styles.tabsList}>
            {testItems.map((item, index) => (
              <TabsTrigger key={item.id} value={index.toString()}>
                {item.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {testItems.map((item, index) => (
            <TabsContent key={item.id} value={index.toString()}>
              {renderContent()}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};