import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTestLeaderboardQuery } from '../helpers/useTestLeaderboardQuery';
import { useAuth } from '../helpers/useAuth';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { Trophy, BarChart2, Lock } from 'lucide-react';
import styles from './TestLeaderboard.module.css';

interface TestLeaderboardProps {
  testItems: Array<{ id: number; title: string }>;
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
  onViewFull,
  className,
}) => {
  const { authState } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedTestItem = testItems[selectedIndex];
  const { data, isFetching, error } = useTestLeaderboardQuery(
    selectedTestItem?.id
  );

  const currentUserDisplayName =
    authState.type === 'authenticated' ? authState.user.displayName : null;

  const renderRankIcon = (rank: number) => {
    if (rank === 1)
      return <Trophy size={20} className={styles.goldTrophy} />;
    if (rank === 2)
      return <Trophy size={20} className={styles.silverTrophy} />;
    if (rank === 3)
      return <Trophy size={20} className={styles.bronzeTrophy} />;
    return <span className={styles.rankNumber}>{rank}</span>;
  };

  const location = useLocation();

  const renderContent = () => {
    // Check authentication first
    if (authState.type !== 'authenticated') {
      return (
        <div className={styles.loginPrompt}>
          <Trophy size={48} className={styles.loginPromptIcon} />
          <h3 className={styles.loginPromptHeadline}>🏆 Want to See Who's on Top?</h3>
          <p className={styles.loginPromptSubtitle}>Login to view rankings and compete with students across India!</p>
          <div className={styles.loginPromptButtons}>
            <Button asChild>
              <Link to={`/login?redirectTo=${encodeURIComponent(location.pathname)}`}>Login</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/signup?redirectTo=${encodeURIComponent(location.pathname)}`}>Sign Up</Link>
            </Button>
          </div>
        </div>
      );
    }

    if (isFetching && !data) {
      return <LeaderboardSkeleton />;
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

    return (
      <>
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
              const isCurrentUser = entry.studentName === currentUserDisplayName;
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
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Leaderboard</h3>
      </div>

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