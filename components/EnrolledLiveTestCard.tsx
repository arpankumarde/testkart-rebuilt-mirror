import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, CalendarDays } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Placeholder } from '../helpers/placeholderImages';
import type { EnrolledLiveTestItem } from '../endpoints/student/enrolled-live-tests_GET.schema';
import styles from './EnrolledLiveTestCard.module.css';

interface LiveTestCardProps {
  test: EnrolledLiveTestItem;
  className?: string;
}

/**
 * Card for a single enrolled live test, used both as a dashboard preview
 * and on the full /student/live listing. Mirrors EnrolledTestCard's compact
 * layout (small thumbnail + header row, tight footer button) instead of the
 * old large-thumbnail-on-top design, so live test cards match the mock test
 * cards' size/density on the dashboard.
 */
export const EnrolledLiveTestCard: React.FC<LiveTestCardProps> = ({ test, className }) => {
  const isEnded = test.status === 'ended';
  const buttonVariant = isEnded ? (test.hasAttempted ? 'primary' : 'outline') : 'primary';

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
            {isEnded ? (
              <>
                <Badge variant="secondary">Ended</Badge>
                {test.hasAttempted ? (
                  <Badge variant="success">Attempted</Badge>
                ) : (
                  <Badge variant="outline">Not Attempted</Badge>
                )}
              </>
            ) : (
              <>
                <Badge variant={test.status === 'live' ? 'success' : 'default'}>
                  {test.status === 'live' ? 'Live Now' : 'Upcoming'}
                </Badge>
                {test.hasPrizes && (
                  <Badge variant="warning">
                    <Trophy size={12} className={styles.badgeIcon} /> Prizes
                  </Badge>
                )}
              </>
            )}
          </div>
          <h3 className={styles.title}>{test.title}</h3>
          <p className={styles.teacher}>by {test.teacherName}</p>
        </div>
      </div>

      <div className={styles.metaRow}>
        <CalendarDays size={14} />
        <span>
          {isEnded
            ? `Ended: ${new Date(test.endTime).toLocaleDateString()}`
            : `Starts: ${test.startTime ? new Date(test.startTime).toLocaleString() : 'TBD'}`}
        </span>
      </div>

      <div className={styles.actions}>
        <Button asChild variant={buttonVariant} className={styles.actionButton}>
          <Link to={`/mock-test/live/${test.id}`}>
            {isEnded ? 'View Results & Leaderboard' : 'View Details'}
          </Link>
        </Button>
      </div>
    </div>
  );
};
