import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BarChart2, Lock, Search, Trophy, User } from 'lucide-react';
import { isLeaderboardLocked, useTestLeaderboardQuery } from '../helpers/useTestLeaderboardQuery';
import { useDebounce } from '../helpers/useDebounce';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import styles from './TestItemLeaderboard.module.css';

const PAGE_SIZE = 50;

const formatRelativeTime = (date: Date): string => {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) {
    const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
    return hours < 1 ? 'just now' : `${hours}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const medal = (rank: number) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : undefined);

/*
 * The whole leaderboard of one test paper, fetched by its test item id - never
 * by series. Shows the viewer's own standing first, then a searchable ranked
 * table with their row highlighted. Access is enforced by /_api/tests/leaderboard.
 */
export const TestItemLeaderboard: React.FC<{ testItemId: number }> = ({ testItemId }) => {
  const { data, isFetching, error, refetch } = useTestLeaderboardQuery(testItemId);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const myRowRef = useRef<HTMLDivElement>(null);
  const [scrollToMe, setScrollToMe] = useState(false);

  const you = data?.currentUserBestRank ?? null;
  const total = data?.leaderboard.length ?? 0;

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = debouncedSearch.trim().toLowerCase();
    return term ? data.leaderboard.filter((e) => e.studentName.toLowerCase().includes(term)) : data.leaderboard;
  }, [data, debouncedSearch]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [debouncedSearch]);

  useEffect(() => {
    if (!scrollToMe) return;
    myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollToMe(false);
  }, [scrollToMe, visibleCount]);

  const showMyRow = () => {
    if (!you) return;
    setSearchTerm('');
    setVisibleCount((count) => Math.max(count, Math.ceil(you.rank / PAGE_SIZE) * PAGE_SIZE));
    setScrollToMe(true);
  };

  if (isFetching && !data) {
    return (
      <div className={styles.panel} aria-busy="true">
        <Skeleton className={styles.summarySkeleton} />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className={styles.rowSkeleton} />
        ))}
      </div>
    );
  }

  if (isLeaderboardLocked(error)) {
    return (
      <div className={styles.state}>
        <Lock size={28} aria-hidden="true" />
        <h2>Leaderboard locked</h2>
        <p>{(error as Error).message}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.state} role="alert">
        <AlertCircle size={28} aria-hidden="true" />
        <h2>Could not load the leaderboard</h2>
        <p>The request did not come back. Check your connection and try again.</p>
        <Button variant="outline" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        {you ? (
          <>
            <div className={styles.summaryRank}>
              <span className={styles.summaryLabel}>Your rank</span>
              <span className={styles.summaryRankValue}>
                #{you.rank}
                <span className={styles.summaryOf}>of {total}</span>
              </span>
            </div>
            <dl className={styles.summaryStats}>
              <div><dt>Score</dt><dd>{you.score.toFixed(2)}%</dd></div>
              <div><dt>Time</dt><dd>{you.timeTaken} min</dd></div>
              <div><dt>Best attempt</dt><dd>#{you.attemptNumber}</dd></div>
              <div><dt>Completed</dt><dd>{formatRelativeTime(new Date(you.completedAt))}</dd></div>
            </dl>
            <Button variant="outline" size="sm" onClick={showMyRow} className={styles.findMe}>
              Show my position
            </Button>
          </>
        ) : (
          <p className={styles.summaryEmpty}>
            <Trophy size={16} aria-hidden="true" />
            Complete this test to get a rank. {total > 0 ? `${total} ${total === 1 ? 'student has' : 'students have'} finished it so far.` : ''}
          </p>
        )}
      </div>

      {total === 0 ? (
        <div className={styles.state}>
          <BarChart2 size={28} aria-hidden="true" />
          <h2>No finished attempts yet</h2>
          <p>Rankings appear here once students complete this test.</p>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search by student name"
                aria-label="Search by student name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <span className={styles.count}>
              {filtered.length} {filtered.length === 1 ? 'student' : 'students'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.state}>
              <User size={28} aria-hidden="true" />
              <h2>No matching students</h2>
              <p>No one on this leaderboard matches "{debouncedSearch}".</p>
            </div>
          ) : (
            <div className={styles.table} role="table" aria-label="Leaderboard">
              <div className={styles.headRow} role="row">
                <span role="columnheader" className={styles.colRank}>Rank</span>
                <span role="columnheader">Student</span>
                <span role="columnheader" className={styles.colNum}>Score</span>
                <span role="columnheader" className={styles.colNum}>Time</span>
                <span role="columnheader" className={`${styles.colNum} ${styles.colDate}`}>Completed</span>
              </div>
              {visible.map((entry) => {
                const isYou = you?.rank === entry.rank;
                return (
                  <div
                    key={entry.rank}
                    ref={isYou ? myRowRef : undefined}
                    role="row"
                    className={styles.row}
                    data-you={isYou || undefined}
                    aria-current={isYou ? 'true' : undefined}
                  >
                    <span role="cell" className={styles.colRank}>
                      <span className={styles.rankBadge} data-medal={medal(entry.rank)}>
                        {entry.rank <= 3 && <Trophy size={12} aria-hidden="true" />}
                        {entry.rank}
                      </span>
                    </span>
                    <span role="cell" className={styles.student}>
                      <span className={styles.avatar} aria-hidden="true">
                        {entry.studentName.charAt(0).toUpperCase()}
                      </span>
                      <span className={styles.nameBlock}>
                        <span className={styles.name}>
                          <span className={styles.nameText}>{entry.studentName}</span>
                          {isYou && <span className={styles.youTag}>You</span>}
                        </span>
                        <span className={styles.sub}>
                          Attempt {entry.attemptNumber}
                          <span className={styles.subDate}> - {formatRelativeTime(new Date(entry.completedAt))}</span>
                        </span>
                      </span>
                    </span>
                    <span role="cell" className={`${styles.colNum} ${styles.score}`}>{entry.score.toFixed(2)}%</span>
                    <span role="cell" className={styles.colNum}>{entry.timeTaken} min</span>
                    <span role="cell" className={`${styles.colNum} ${styles.colDate} ${styles.date}`}>
                      {formatRelativeTime(new Date(entry.completedAt))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <div className={styles.footer}>
              <span className={styles.count}>
                Showing {visible.length} of {filtered.length}
              </span>
              {visibleCount < filtered.length && (
                <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Load more
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};