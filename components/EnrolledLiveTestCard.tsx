import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, CalendarDays } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Placeholder } from '../helpers/placeholderImages';
import { liveTestPath } from '../helpers/liveTestRoutes';
import type { EnrolledLiveTestItem } from '../endpoints/student/enrolled-live-tests_GET.schema';
import styles from './EnrolledLiveTestCard.module.css';

interface LiveTestCardProps {
  test: EnrolledLiveTestItem;
  className?: string;
}

/**
 * Card for a single enrolled live test, used both as a dashboard preview
 * and on the full /student/live listing. Same compact layout as
 * EnrolledTestCard. One status badge, one date line and one button, each
 * worded for where the test is: upcoming, live, or ended.
 */
const formatWhen = (value: string | Date, withTime: boolean) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : { year: 'numeric' }),
  });

export const EnrolledLiveTestCard: React.FC<LiveTestCardProps> = ({ test, className }) => {
  const isEnded = test.status === 'ended';
  const isLive = test.status === 'live';
  const buttonVariant = isEnded ? (test.hasAttempted ? 'primary' : 'outline') : 'primary';

  const status: { label: string; variant: 'success' | 'default' | 'outline' } = isEnded
    ? test.hasAttempted
      ? { label: 'Attempted', variant: 'success' }
      : { label: 'Missed', variant: 'outline' }
    : isLive
      ? { label: 'Live now', variant: 'success' }
      : { label: 'Upcoming', variant: 'default' };

  const when = isEnded
    ? `Ended ${formatWhen(test.endTime, false)}`
    : isLive
      ? `Ends ${formatWhen(test.endTime, true)}`
      : test.startTime
        ? `Starts ${formatWhen(test.startTime, true)}`
        : 'Start time to be announced';

  const action = isEnded
    ? test.hasAttempted
      ? 'View my result'
      : 'View leaderboard'
    : isLive
      ? 'Join now'
      : 'View details';

  return (
    <div className={`${styles.card} ${className || ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.thumbnail}>
          {test.thumbnailUrl ? (
            <img src={test.thumbnailUrl} alt={test.title} />
          ) : (
            <img src={Placeholder.TEST} alt={test.title} />
          )}
        </div>
        <div className={styles.headerContent}>
          <div className={styles.badges}>
            <Badge variant={status.variant}>{status.label}</Badge>
            {!isEnded && test.hasPrizes && (
              <Badge variant="warning">
                <Trophy size={12} className={styles.badgeIcon} /> Prizes
              </Badge>
            )}
          </div>
          <h3 className={styles.title}>{test.title}</h3>
          <p className={styles.teacher}>by {test.teacherName}</p>
        </div>
      </div>

      <div className={styles.metaRow}>
        <CalendarDays size={14} />
        <span>{when}</span>
      </div>

      <div className={styles.actions}>
        <Button asChild variant={buttonVariant} className={styles.actionButton}>
          <Link to={liveTestPath(test.slug)}>
            {action}
          </Link>
        </Button>
      </div>
    </div>
  );
};
