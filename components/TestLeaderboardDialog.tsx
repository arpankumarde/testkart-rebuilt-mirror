import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
import { Input } from './Input';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { useTestLeaderboardQuery } from '../helpers/useTestLeaderboardQuery';
import { useAuth } from '../helpers/useAuth';
import { useDebounce } from '../helpers/useDebounce';
import { Trophy, Search, Info, AlertCircle, User, BarChart2, X } from 'lucide-react';
import { LeaderboardEntry } from '../endpoints/tests/leaderboard_GET.schema';
import styles from './TestLeaderboardDialog.module.css';

type TestItem = {
  id: number;
  title: string;
};

interface TestLeaderboardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  testItems: TestItem[];
  defaultTestItemIndex?: number;
  packageTitle: string;
  className?: string;
}

const PAGE_SIZE = 50;

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)} years ago`;
  
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)} months ago`;
  
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)} days ago`;
  
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)} hours ago`;
  
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)} minutes ago`;
  
  return `${Math.floor(seconds)} seconds ago`;
};

const LeaderboardSkeleton: React.FC = () => (
  <div className={styles.skeletonContainer} aria-hidden="true">
    {[...Array(8)].map((_, i) => (
      <div key={i} className={styles.skeletonRow}>
        <Skeleton className={styles.skeletonRank} />
        <Skeleton className={styles.skeletonName} />
        <Skeleton className={styles.skeletonScore} />
        <Skeleton className={styles.skeletonTime} />
        <Skeleton className={styles.skeletonTime} />
      </div>
    ))}
  </div>
);

const LeaderboardView: React.FC<{ testItemId: number }> = ({ testItemId }) => {
  const { authState } = useAuth();
  const { data, isFetching, error, refetch } = useTestLeaderboardQuery(testItemId);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const currentUserDisplayName = authState.type === 'authenticated' ? authState.user.displayName : null;

  const filteredLeaderboard = useMemo(() => {
    if (!data?.leaderboard) return [];
    return data.leaderboard.filter(entry =>
      entry.studentName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [data?.leaderboard, debouncedSearchTerm]);

  const visibleEntries = useMemo(() => {
    return filteredLeaderboard.slice(0, visibleCount);
  }, [filteredLeaderboard, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredLeaderboard.length));
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearchTerm]);

  const medal = (rank: number) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : undefined);

  if (isFetching && !data) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className={styles.stateContainer}>
        <AlertCircle size={36} aria-hidden="true" />
        <h3>Failed to load leaderboard</h3>
        <p>There was an issue fetching the data. Please try again.</p>
        <Button onClick={() => refetch()} variant="outline" className={styles.pillButton}>Retry</Button>
      </div>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className={styles.stateContainer}>
        <BarChart2 size={36} aria-hidden="true" />
        <h3>No Submissions Yet</h3>
        <p>The leaderboard will appear here once students start completing this test.</p>
      </div>
    );
  }

  return (
    <div className={styles.leaderboardContent}>
      <div className={styles.searchInputWrapper}>
        <Search className={styles.searchIcon} size={17} aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search by student name..."
          aria-label="Search by student name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {filteredLeaderboard.length === 0 && debouncedSearchTerm ? (
        <div className={styles.stateContainer}>
          <User size={36} aria-hidden="true" />
          <h3>No Results Found</h3>
          <p>No students match your search for "{debouncedSearchTerm}".</p>
        </div>
      ) : (
        <>
          <div className={styles.tableScroller}>
            <div className={styles.table} role="table" aria-label="Leaderboard">
              <div className={styles.tableHeader} role="row">
                <div className={styles.headerCellRank} role="columnheader">Rank</div>
                <div className={styles.headerCellName} role="columnheader">Student</div>
                <div className={styles.headerCellNum} role="columnheader">Score</div>
                <div className={styles.headerCellNum} role="columnheader">Time</div>
                <div className={styles.headerCellNum} role="columnheader">Completed</div>
              </div>
              <div className={styles.tableBody}>
                {visibleEntries.map((entry: LeaderboardEntry) => {
                  const isCurrentUser = entry.studentName === currentUserDisplayName;
                  return (
                    <div
                      key={entry.rank}
                      role="row"
                      className={`${styles.tableRow} ${isCurrentUser ? styles.currentUserRow : ''}`}
                      data-medal={medal(entry.rank)}
                    >
                      <div className={styles.cellRank} role="cell">
                        <span className={styles.rankBadge} data-medal={medal(entry.rank)}>
                          {entry.rank <= 3 && <Trophy size={12} aria-hidden="true" />}
                          {entry.rank}
                        </span>
                      </div>
                      <div className={styles.cellName} role="cell">
                        <span className={styles.avatar} aria-hidden="true">
                          {entry.studentName.charAt(0).toUpperCase()}
                        </span>
                        <span className={styles.nameBlock}>
                          <span className={styles.studentName}>
                            {entry.studentName}
                            {isCurrentUser && <span className={styles.youTag}>You</span>}
                          </span>
                          <span className={styles.attemptText}>Attempt {entry.attemptNumber}</span>
                        </span>
                      </div>
                      <div className={styles.cellScore} role="cell">{entry.score.toFixed(2)}</div>
                      <div className={styles.cellTime} role="cell">{entry.timeTaken} min</div>
                      <div className={styles.cellDate} role="cell">{formatRelativeTime(new Date(entry.completedAt))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className={styles.paginationFooter}>
            <p className={styles.paginationInfo}>
              Showing {visibleEntries.length} of {filteredLeaderboard.length} students
            </p>
            {visibleCount < filteredLeaderboard.length && (
              <Button onClick={handleLoadMore} variant="outline" className={styles.pillButton}>Load More</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const TestLeaderboardDialog: React.FC<TestLeaderboardDialogProps> = ({
  isOpen,
  onClose,
  testItems,
  defaultTestItemIndex = 0,
  packageTitle,
  className,
}) => {
  const [activeTestItemId, setActiveTestItemId] = useState<number | null>(null);

  useEffect(() => {
    if (testItems.length > 0) {
      const defaultIndex = defaultTestItemIndex >= 0 && defaultTestItemIndex < testItems.length ? defaultTestItemIndex : 0;
      setActiveTestItemId(testItems[defaultIndex].id);
    }
  }, [testItems, defaultTestItemIndex]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideCloseButton className={`${styles.dialogContent} ${className || ''}`}>
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Trophy size={18} />
          </span>
          <DialogHeader className={styles.headerText}>
            <DialogTitle className={styles.title}>{packageTitle}</DialogTitle>
            <DialogDescription className={styles.subtitle}>
              Leaderboard rankings for each test in this series.
            </DialogDescription>
          </DialogHeader>
          <DialogClose className={styles.closeButton} aria-label="Close leaderboard">
            <X size={18} aria-hidden="true" />
          </DialogClose>
        </div>

        <div className={styles.body}>
          {testItems.length > 0 && activeTestItemId !== null ? (
            <Tabs
              defaultValue={activeTestItemId.toString()}
              onValueChange={(val) => setActiveTestItemId(Number(val))}
              className={styles.innerTabsContainer}
            >
              {testItems.length > 1 && (
                <TabsList className={styles.testItemsTabsList} aria-label="Choose a test">
                  {testItems.map(item => (
                    <TabsTrigger key={item.id} value={item.id.toString()} className={styles.testItemTab}>
                      {item.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}

              {testItems.map(item => (
                <TabsContent key={item.id} value={item.id.toString()} className={styles.innerTabsContent}>
                  {activeTestItemId === item.id && <LeaderboardView testItemId={item.id} />}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className={styles.stateContainer}>
              <Info size={36} aria-hidden="true" />
              <h3>No Tests Available</h3>
              <p>There are no test items in this package to display a leaderboard for.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};