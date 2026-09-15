import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookCopy,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileQuestion,
  Info,
  Lock,
  PlayCircle,
  Repeat,
  Target,
} from 'lucide-react';
import type { EnrolledTest, TestItemWithProgress } from '../endpoints/student/enrolled-tests_GET.schema';
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

export const TestItemRow: React.FC<{ item: TestItemWithProgress; isTeacher: boolean }> = ({ item, isTeacher }) => {
  const isScheduled = item.scheduledDate && new Date(item.scheduledDate) > new Date();
  
  const getStatus = (): { label: string; variant: 'success' | 'warning' | 'outline' | 'secondary' } => {
    if (item.isCompleted) {
      return { label: 'Completed', variant: 'success' };
    }
    if (item.attemptsCount > 0) {
      return { label: 'In progress', variant: 'warning' };
    }
    if (isScheduled) {
      return { label: 'Scheduled', variant: 'secondary' };
    }
    return { label: 'Not started', variant: 'outline' };
  };

  const status = getStatus();
  const hasBeenAttempted = item.attemptsCount > 0;
  const testUrl = `/portal/${item.id}`;
  const resultsUrl = `/portal/${item.id}/results`;
  
  const scheduledDateStr = item.scheduledDate 
    ? new Date(item.scheduledDate).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      })
    : '';

  return (
    <div className={styles.testItem}>
      <div className={styles.itemMain}>
        <div className={styles.itemTitleWrapper}>
          <span className={styles.itemTitle}>{item.title}</span>
          {item.subject && <Badge variant="secondary">{item.subject}</Badge>}
        </div>
        <div className={styles.itemMeta}>
          <div className={styles.itemMetaChip}>
            <Clock size={14} />
            <span>{item.durationMinutes > 0 ? `${item.durationMinutes} min` : "No Time Limit"}</span>
          </div>
          <div className={styles.itemMetaChip}>
            <FileQuestion size={14} />
            <span>{item.totalQuestions} Qs</span>
          </div>
          {isScheduled && (
            <div className={styles.scheduledInfo}>
              Available: {scheduledDateStr}
            </div>
          )}
        </div>
      </div>
      <div className={styles.itemStatus}>
        <Badge variant={status.variant} className={styles.statusBadge}>
          {status.label}
        </Badge>
        {item.bestScore !== null && (
          <div className={styles.bestScore}>
            Best Score:
            <span className={styles[getScoreColor(item.bestScore)]}>
              {item.bestScore.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      {!isTeacher && (
        <div className={styles.itemActions}>
          {item.isCompleted ? (
          <>
            <Link to={resultsUrl} className={`${styles.actionButton} ${styles.primaryAction}`}>
              <Eye size={16} />
              <span>View Result</span>
            </Link>
            <Link to={testUrl} className={`${styles.actionButton} ${styles.secondaryAction}`}>
              <Repeat size={16} />
              <span>Retake</span>
            </Link>
          </>
        ) : isScheduled ? (
             <button className={`${styles.actionButton} ${styles.disabledAction}`} disabled>
                <Lock size={16} />
                <span>Locked</span>
             </button>
        ) : (
              <Link to={testUrl} className={styles.actionButton}>
                {hasBeenAttempted ? <Repeat size={16} /> : <PlayCircle size={16} />}
                <span>{hasBeenAttempted ? 'Retake Test' : 'Start Test'}</span>
              </Link>
            )}
          </div>
        )}
      </div>
  );
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