import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { EnrolledTest } from '../endpoints/student/enrolled-tests_GET.schema';
import { Badge } from './Badge';
import { Progress } from './Progress';
import { Placeholder } from '../helpers/placeholderImages';
import styles from './EnrolledTestCard.module.css';

interface EnrolledTestCardProps {
  enrolledTest: EnrolledTest;
  className?: string;
}

const getScoreColor = (score: number | null): 'success' | 'warning' | 'destructive' | 'default' => {
  if (score === null) return 'default';
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'destructive';
};

const getPackageStatus = (
  completedItems: number,
  totalItems: number
): { label: string; action: string; variant: 'success' | 'warning' | 'outline'; accentVar: string } => {
  if (totalItems > 0 && completedItems === totalItems) {
    return { label: 'Completed', action: 'View results', variant: 'success', accentVar: 'var(--success)' };
  }
  if (completedItems > 0) {
    return { label: 'In progress', action: 'Continue', variant: 'warning', accentVar: 'var(--warning)' };
  }
  return { label: 'Not started', action: 'Start', variant: 'outline', accentVar: 'var(--border)' };
};

/*
 * Summary card for the Mock Tests grid: what the series is, how far along the
 * student is, and one button. The thumbnail, title and button all open the
 * student's own series page, where the test rows (EnrolledTestItemRow) live.
 */
export const EnrolledTestCard: React.FC<EnrolledTestCardProps> = ({ enrolledTest, className }) => {
  const averageScoreColor = getScoreColor(enrolledTest.averageScore);
  const packageStatus = getPackageStatus(enrolledTest.completedItems, enrolledTest.totalItems);
  const seriesUrl = `/student/tests/${enrolledTest.id}`;

  return (
    <div
      className={`${styles.card} ${className || ''}`}
      style={{ '--card-accent': packageStatus.accentVar } as React.CSSProperties}
    >
      <div className={styles.cardHeader}>
        <Link to={seriesUrl} className={styles.thumbnailLink} tabIndex={-1} aria-hidden="true">
          <div className={styles.thumbnail}>
            <img src={enrolledTest.thumbnailUrl || Placeholder.TEST} alt="" className={styles.thumbnailImage} />
          </div>
        </Link>
        <div className={styles.headerContent}>
          <div className={styles.headerBadges}>
            <Badge variant={packageStatus.variant} className={`${styles.headerBadge} ${styles.statusBadgeHeader}`}>
              {packageStatus.label}
            </Badge>
            {enrolledTest.examName && <Badge className={styles.headerBadge}>{enrolledTest.examName}</Badge>}
          </div>
          <Link to={seriesUrl} className={styles.titleLink}>
            <h3 className={styles.title}>{enrolledTest.title}</h3>
          </Link>
        </div>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressTopRow}>
          <span className={styles.progressLabel}>
            {enrolledTest.completedItems} of {enrolledTest.totalItems} tests done
          </span>
          {enrolledTest.averageScore !== null && (
            <span className={`${styles.progressPercent} ${styles[averageScoreColor]}`}>
              Avg {enrolledTest.averageScore.toFixed(1)}%
            </span>
          )}
        </div>
        <Progress value={enrolledTest.progressPercentage} />
      </div>

      <div className={styles.cardFooter}>
        <Link to={seriesUrl} className={styles.viewAllButton}>
          {packageStatus.action}
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
};
