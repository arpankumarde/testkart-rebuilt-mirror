import React from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Check,
  Clock,
  Eye,
  FileQuestion,
  Lock,
  PlayCircle,
  Repeat,
  Trophy,
} from 'lucide-react';
import type { TestItemWithProgress } from '../endpoints/student/enrolled-tests_GET.schema';
import { Badge } from './Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';
import styles from './EnrolledTestItemRow.module.css';

interface EnrolledTestItemRowProps {
  item: TestItemWithProgress;
  /* 1-based position in the series. */
  index: number;
  seriesId: number;
  isTeacher: boolean;
}

const scoreTone = (score: number) => (score >= 75 ? 'success' : score >= 50 ? 'warning' : 'destructive');

/*
 * One paper on the enrolled series page. Rows sit in EnrolledTestItemList's
 * grid and take its columns through subgrid, so status, score and actions line
 * up down the list whatever each row's buttons are.
 */
export const EnrolledTestItemRow: React.FC<EnrolledTestItemRowProps> = ({ item, index, seriesId, isTeacher }) => {
  const isScheduled = !!item.scheduledDate && new Date(item.scheduledDate) > new Date();
  const hasAttempted = item.attemptsCount > 0;
  const testUrl = `/portal/${item.id}`;
  const resultsUrl = `/portal/${item.id}/results`;
  const leaderboardUrl = `/student/tests/${seriesId}/leaderboard/${item.id}`;

  const status: { label: string; variant: 'success' | 'warning' | 'outline' | 'secondary' } = item.isCompleted
    ? { label: 'Completed', variant: 'success' }
    : hasAttempted
      ? { label: 'In progress', variant: 'warning' }
      : isScheduled
        ? { label: 'Scheduled', variant: 'secondary' }
        : { label: 'Not started', variant: 'outline' };

  const scheduledLabel = item.scheduledDate
    ? new Date(item.scheduledDate).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  return (
    <li className={styles.row} data-completed={item.isCompleted || undefined}>
      <span className={styles.index} aria-hidden="true">
        {item.isCompleted ? <Check size={14} strokeWidth={3} /> : String(index).padStart(2, '0')}
      </span>

      <div className={styles.main}>
        <div className={styles.titleLine}>
          <h3 className={styles.title}>{item.title}</h3>
          {item.subject && <span className={styles.subject}>{item.subject}</span>}
        </div>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <Clock size={13} aria-hidden="true" />
            {item.durationMinutes > 0 ? `${item.durationMinutes} min` : 'No time limit'}
          </span>
          <span className={styles.metaItem}>
            <FileQuestion size={13} aria-hidden="true" />
            {item.totalQuestions} Qs
          </span>
          {hasAttempted && (
            <span className={styles.metaItem}>
              <Repeat size={13} aria-hidden="true" />
              {item.attemptsCount} {item.attemptsCount === 1 ? 'attempt' : 'attempts'}
            </span>
          )}
          {isScheduled && (
            <span className={`${styles.metaItem} ${styles.scheduled}`}>
              <CalendarClock size={13} aria-hidden="true" />
              Opens {scheduledLabel}
            </span>
          )}
        </div>
      </div>

      <div className={styles.result}>
        <Badge variant={status.variant} className={styles.statusBadge}>{status.label}</Badge>
        {item.bestScore !== null ? (
          <span className={styles.bestScore}>
            Best <strong className={styles[scoreTone(item.bestScore)]}>{item.bestScore.toFixed(2)}%</strong>
          </span>
        ) : (
          <span className={styles.bestScore}>No score yet</span>
        )}
      </div>

      <div className={styles.actions}>
        {!isScheduled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={leaderboardUrl}
                className={`${styles.button} ${styles.iconButton}`}
                aria-label={`Leaderboard for ${item.title}`}
              >
                <Trophy size={16} aria-hidden="true" />
                <span className={styles.iconButtonLabel}>Leaderboard</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Leaderboard</TooltipContent>
          </Tooltip>
        )}
        {!isTeacher &&
          (item.isCompleted ? (
            <>
              <Link to={testUrl} className={styles.button}>
                <Repeat size={15} aria-hidden="true" />
                Retake
              </Link>
              <Link to={resultsUrl} className={`${styles.button} ${styles.solidButton}`}>
                <Eye size={15} aria-hidden="true" />
                View result
              </Link>
            </>
          ) : isScheduled ? (
            <button type="button" className={`${styles.button} ${styles.disabledButton}`} disabled>
              <Lock size={15} aria-hidden="true" />
              Locked
            </button>
          ) : (
            <Link to={testUrl} className={`${styles.button} ${styles.solidButton}`}>
              {hasAttempted ? <Repeat size={15} aria-hidden="true" /> : <PlayCircle size={15} aria-hidden="true" />}
              {hasAttempted ? 'Retake test' : 'Start test'}
            </Link>
          ))}
      </div>
    </li>
  );
};

export const EnrolledTestItemList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ol className={styles.list}>{children}</ol>
);