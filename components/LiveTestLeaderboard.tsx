import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveTestLeaderboardQuery } from '../helpers/useLiveTestLeaderboardQuery';
import { useAuth } from '../helpers/useAuth';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { Trophy, User, BarChart2, Clock, AlertCircle, Lock, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import { getPrizeForRank } from '../helpers/liveTestPrizeTiers';
import styles from './LiveTestLeaderboard.module.css';

interface LiveTestLeaderboardProps {
  liveTestId: number;
  autoRefresh?: boolean;
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

const formatIndianCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const LiveTestLeaderboard: React.FC<LiveTestLeaderboardProps> = ({
  liveTestId,
  autoRefresh = true,
  className,
}) => {
  const { authState } = useAuth();
  const location = useLocation();
  const { data, isFetching, error, refetch } = useLiveTestLeaderboardQuery(liveTestId, autoRefresh);

  // Check authentication first
  if (authState.type !== 'authenticated') {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.loginPrompt}>
          <Trophy size={48} className={styles.loginPromptIcon} />
          <h3 className={styles.loginPromptHeadline}>🏆 Want to See the Live Rankings?</h3>
          <p className={styles.loginPromptSubtitle}>Login to view real-time leaderboard and compete for prizes!</p>
          <div className={styles.loginPromptButtons}>
            <Button asChild>
              <Link to={`/login?redirectTo=${encodeURIComponent(location.pathname)}`}>Login</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/signup?redirectTo=${encodeURIComponent(location.pathname)}`}>Sign Up</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentUserDisplayName = authState.type === 'authenticated' ? authState.user.displayName : null;

  if (isFetching && !data) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return <div className={styles.errorState}>Failed to load leaderboard. Please try again later.</div>;
  }

  if (!data) {
    return (
      <div className={styles.emptyState}>
        <BarChart2 size={48} />
        <h3>No Data Available</h3>
        <p>Unable to load leaderboard data.</p>
      </div>
    );
  }

  if (data.leaderboard.length === 0) {
    // Show different messages based on test status
    if (data.testStatus === 'not_started') {
      return (
        <div className={styles.emptyState}>
          <Clock size={48} />
          <h3>Test Hasn't Started Yet</h3>
          <p>The leaderboard will be available once the test begins. Check back at the scheduled start time.</p>
        </div>
      );
    }

    if (data.testStatus === 'ongoing') {
      return (
        <div className={styles.emptyState}>
          <BarChart2 size={48} />
          <h3>No Submissions Yet</h3>
          <p>The leaderboard will appear here once students start completing the test.</p>
        </div>
      );
    }

    // testStatus === 'completed'
    return (
      <div className={styles.emptyState}>
        <AlertCircle size={48} />
        <h3>No Submissions</h3>
        <p>No students completed this test.</p>
      </div>
    );
  }

  const { leaderboard, currentUserRank } = data;

  const renderRankIcon = (rank: number) => {
    const tiers = data.dynamicPrizes?.tiers ?? [];
    const prizeAmount = data.dynamicPrizes ? getPrizeForRank(tiers, rank) : 0;

    if (rank === 1) {
      return (
        <div className={styles.rankWithPrize}>
          <Trophy size={20} className={styles.goldTrophy} />
          {prizeAmount > 0 && (
            <span className={styles.prizeAmount}>{formatIndianCurrency(prizeAmount)}</span>
          )}
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className={styles.rankWithPrize}>
          <Trophy size={20} className={styles.silverTrophy} />
          {prizeAmount > 0 && (
            <span className={styles.prizeAmount}>{formatIndianCurrency(prizeAmount)}</span>
          )}
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className={styles.rankWithPrize}>
          <Trophy size={20} className={styles.bronzeTrophy} />
          {prizeAmount > 0 && (
            <span className={styles.prizeAmount}>{formatIndianCurrency(prizeAmount)}</span>
          )}
        </div>
      );
    }
    if (prizeAmount > 0) {
      return (
        <div className={styles.rankWithPrize}>
          <span className={styles.rankNumber}>{rank}</span>
          <span className={styles.prizeAmount}>{formatIndianCurrency(prizeAmount)}</span>
        </div>
      );
    }
    return <span className={styles.rankNumber}>{rank}</span>;
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Live Leaderboard</h3>
        {autoRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={isFetching ? styles.spinning : undefined} />
            Refresh
          </Button>
        )}
      </div>
      
      {data.testStatus === 'ongoing' && (
        <div className={`${styles.statusBanner} ${styles.statusOngoing}`}>
          <Info size={18} />
          <span>⏳ Rankings are not final. The leaderboard will be finalized after the test ends. Current positions may change as more students submit their answers.</span>
        </div>
      )}
      
      {data.testStatus === 'completed' && (
        <div className={`${styles.statusBanner} ${styles.statusCompleted}`}>
          <CheckCircle2 size={18} />
          <span>✅ Final Rankings — The leaderboard is now final.</span>
        </div>
      )}
      
      {!!data.dynamicPrizes?.isReduced && (
        <div className={`${styles.statusBanner} ${styles.prizeDisclaimer}`}>
          <Info size={18} />
          <span>💰 Prize amounts shown here are adjusted based on actual enrollment revenue collected, which is currently less than the total advertised prize pool. The maximum prize will be equal to the amount set by the creator.</span>
        </div>
      )}

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div className={styles.headerCellRank}>Rank</div>
          <div className={styles.headerCellName}>Student Name</div>
          <div className={styles.headerCellScore}>Score</div>
          <div className={styles.headerCellTime}>Time Taken</div>
        </div>
        <div className={styles.tableBody}>
          {leaderboard.map((entry) => {
            const isCurrentUser = entry.studentName === currentUserDisplayName;
            return (
              <div key={entry.rank} className={`${styles.tableRow} ${isCurrentUser ? styles.currentUserRow : ''}`}>
                <div className={styles.cellRank} data-label="Rank">{renderRankIcon(entry.rank)}</div>
                <div className={styles.cellName} data-label="Student">{entry.studentName}</div>
                <div className={styles.cellScore} data-label="Score">{entry.score.toFixed(2)}</div>
                <div className={styles.cellTime} data-label="Time">{entry.timeTaken} min</div>
              </div>
            );
          })}
        </div>
      </div>
      {data.currentUserStatus === 'enrolled_not_attempted' && (
        <div className={styles.currentUserSummary}>
          <h4>Your Rank</h4>
          <div className={styles.notAttemptedMessage}>
            <Info size={18} />
            <span>You haven't attempted the test yet. Complete the test to see your rank.</span>
          </div>
        </div>
      )}
      {data.currentUserStatus === 'attempted' && currentUserRank && (
        <div className={styles.currentUserSummary}>
          <h4>Your Rank</h4>
          <div className={`${styles.tableRow} ${styles.currentUserRow}`}>
            <div className={styles.cellRank} data-label="Rank">{renderRankIcon(currentUserRank.rank)}</div>
            <div className={styles.cellName} data-label="Student">{currentUserRank.studentName}</div>
            <div className={styles.cellScore} data-label="Score">{currentUserRank.score.toFixed(2)}</div>
            <div className={styles.cellTime} data-label="Time">{currentUserRank.timeTaken} min</div>
          </div>
        </div>
      )}
    </div>
  );
};