import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
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
import { Trophy, Search, Info, AlertCircle, User, BarChart2 } from 'lucide-react';
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
  <div className={styles.skeletonContainer}>
    {[...Array(10)].map((_, i) => (
      <div key={i} className={styles.skeletonRow}>
        <Skeleton className={styles.skeletonRank} />
        <Skeleton className={styles.skeletonName} />
        <Skeleton className={styles.skeletonScore} />
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

  const renderRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={20} className={styles.goldTrophy} />;
    if (rank === 2) return <Trophy size={20} className={styles.silverTrophy} />;
    if (rank === 3) return <Trophy size={20} className={styles.bronzeTrophy} />;
    return <span className={styles.rankNumber}>{rank}</span>;
  };

  if (isFetching && !data) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className={styles.stateContainer}>
        <AlertCircle size={48} />
        <h3>Failed to load leaderboard</h3>
        <p>There was an issue fetching the data. Please try again.</p>
        <Button onClick={() => refetch()} variant="outline">Retry</Button>
      </div>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className={styles.stateContainer}>
        <BarChart2 size={48} />
        <h3>No Submissions Yet</h3>
        <p>The leaderboard will appear here once students start completing this test.</p>
      </div>
    );
  }

  return (
    <div className={styles.leaderboardContent}>
      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <Search className={styles.searchIcon} size={18} />
          <Input
            type="text"
            placeholder="Search by student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {filteredLeaderboard.length === 0 && debouncedSearchTerm ? (
        <div className={styles.stateContainer}>
          <User size={48} />
          <h3>No Results Found</h3>
          <p>No students match your search for "{debouncedSearchTerm}".</p>
        </div>
      ) : (
        <>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <div className={styles.headerCellRank}>Rank</div>
              <div className={styles.headerCellName}>Student</div>
              <div className={styles.headerCellScore}>Score</div>
              <div className={styles.headerCellTime}>Time</div>
              <div className={styles.headerCellDate}>Completed</div>
            </div>
            <div className={styles.tableBody}>
              {visibleEntries.map((entry: LeaderboardEntry) => {
                const isCurrentUser = entry.studentName === currentUserDisplayName;
                return (
                  <div key={entry.rank} className={`${styles.tableRow} ${isCurrentUser ? styles.currentUserRow : ''}`}>
                    <div className={styles.cellRank} data-label="Rank">{renderRankIcon(entry.rank)}</div>
                    <div className={styles.cellName} data-label="Student">
                      {entry.studentName}
                      <span className={styles.attemptBadge}>Attempt {entry.attemptNumber}</span>
                    </div>
                    <div className={styles.cellScore} data-label="Score">{entry.score.toFixed(2)}</div>
                    <div className={styles.cellTime} data-label="Time">{entry.timeTaken} min</div>
                    <div className={styles.cellDate} data-label="Completed">{formatRelativeTime(new Date(entry.completedAt))}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.paginationFooter}>
            <p className={styles.paginationInfo}>
              Showing {visibleEntries.length} of {filteredLeaderboard.length} students
            </p>
            {visibleCount < filteredLeaderboard.length && (
              <Button onClick={handleLoadMore} variant="secondary">Load More</Button>
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
      <DialogContent className={`${styles.dialogContent} ${className || ''}`}>
        <Tabs defaultValue="leaderboard" className={styles.tabsContainer}>
          <div className={styles.stickyHeader}>
            <DialogHeader className={styles.dialogHeader}>
              <DialogTitle>{packageTitle}</DialogTitle>
              <DialogDescription>
                View rankings and performance statistics for all tests in this package.
              </DialogDescription>
            </DialogHeader>
            <TabsList className={styles.mainTabsList}>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              <TabsTrigger value="about">About Test</TabsTrigger>
            </TabsList>
          </div>

          <div className={styles.scrollableContent}>
            <TabsContent value="leaderboard" className={styles.tabsContent}>
              {testItems.length > 0 && activeTestItemId !== null ? (
                <Tabs 
                  defaultValue={activeTestItemId.toString()} 
                  onValueChange={(val) => setActiveTestItemId(Number(val))}
                  className={styles.innerTabsContainer}
                >
                  <TabsList className={styles.testItemsTabsList}>
                    {testItems.map(item => (
                      <TabsTrigger key={item.id} value={item.id.toString()}>
                        {item.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {testItems.map(item => (
                    <TabsContent key={item.id} value={item.id.toString()} className={styles.innerTabsContent}>
                      {activeTestItemId === item.id && <LeaderboardView testItemId={item.id} />}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className={styles.stateContainer}>
                  <Info size={48} />
                  <h3>No Tests Available</h3>
                  <p>There are no test items in this package to display a leaderboard for.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="about" className={`${styles.tabsContent} ${styles.aboutTabContent}`}>
              <div className={styles.aboutCard}>
                <Info size={32} className={styles.aboutIcon} />
                <h3 className={styles.aboutTitle}>{packageTitle}</h3>
                <p className={styles.aboutDescription}>
                  This package contains multiple tests designed to help you prepare for your exams. The leaderboard provides a comprehensive ranking of all participants for each individual test, allowing you to gauge your performance against others.
                </p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};