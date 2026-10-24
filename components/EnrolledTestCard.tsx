import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookCopy,
  CheckCircle2,
  ChevronRight,
  Info,
  Target,
} from 'lucide-react';
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
): { label: string; variant: 'success' | 'warning' | 'outline'; accentVar: string } => {
  if (totalItems > 0 && completedItems === totalItems) {
    return { label: 'Completed', variant: 'success', accentVar: 'var(--success)' };
  }
  if (completedItems > 0) {
    return { label: 'In progress', variant: 'warning', accentVar: 'var(--warning)' };
  }
  return { label: 'Not started', variant: 'outline', accentVar: 'var(--border)' };
};

/* Summary card for the Mock Tests grid. The series' own test rows live in EnrolledTestItemRow. */
export const EnrolledTestCard: React.FC<EnrolledTestCardProps> = ({ enrolledTest, className }) => {
  const formattedEnrolledDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    }).format(new Date(enrolledTest.enrolledAt ?? new Date()));

  const averageScoreColor = getScoreColor(enrolledTest.averageScore);
  const packageStatus = getPackageStatus(enrolledTest.completedItems, enrolledTest.totalItems);

  const testDetailsUrl = `/mock-test/${enrolledTest.slug}`;

  return (
    <div
      className={`${styles.card} ${className || ''}`}
      style={{ '--card-accent': packageStatus.accentVar } as React.CSSProperties}
    >
      <div className={styles.cardHeader}>
        <Link to={testDetailsUrl} className={styles.thumbnailLink}>
          <div className={styles.thumbnail}>
            <img src={enrolledTest.thumbnailUrl || Placeholder.TEST} alt={enrolledTest.title} className={styles.thumbnailImage} />
          </div>
        </Link>
        <div className={styles.headerContent}>
          <div className={styles.headerBadges}>
            <Badge variant={packageStatus.variant} className={`${styles.headerBadge} ${styles.statusBadgeHeader}`}>
              {packageStatus.label}
            </Badge>
            {enrolledTest.examName && <Badge className={styles.headerBadge}>{enrolledTest.examName}</Badge>}
            {!enrolledTest.isPublished && (
              <Badge variant="outline" className={`${styles.headerBadge} ${styles.unpublishedBadge}`}>
                <Info size={12} />
                Unpublished
              </Badge>
            )}
          </div>
          <Link to={testDetailsUrl} className={styles.titleLink}>
            <h3 className={styles.title}>{enrolledTest.title}</h3>
          </Link>
          <p className={styles.enrolledDate}>Enrolled {formattedEnrolledDate}</p>
        </div>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressTopRow}>
          <span className={styles.progressLabel}>Progress</span>
          <span className={styles.progressPercent}>{Math.round(enrolledTest.progressPercentage)}%</span>
        </div>
        <Progress value={enrolledTest.progressPercentage} />
        <div className={styles.statStrip}>
          <span className={styles.statChip}>
            <BookCopy size={14} className={styles.statChipIcon} />
            <strong>{enrolledTest.totalItems}</strong> tests
          </span>
          <span className={styles.statDivider} aria-hidden="true">&bull;</span>
          <span className={styles.statChip}>
            <CheckCircle2 size={14} className={styles.statChipIcon} />
            <strong>{enrolledTest.completedItems}</strong> completed
          </span>
          <span className={styles.statDivider} aria-hidden="true">&bull;</span>
          <span className={styles.statChip}>
            <Target size={14} className={styles.statChipIcon} />
            Avg{' '}
            <strong className={styles[averageScoreColor]}>
              {enrolledTest.averageScore !== null
                ? `${enrolledTest.averageScore.toFixed(1)}%`
                : 'Not scored'}
            </strong>
          </span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <Link to={`/student/tests/${enrolledTest.id}`} className={styles.viewAllButton}>
          View tests
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
};
