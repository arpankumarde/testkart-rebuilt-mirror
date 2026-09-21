import React from 'react';
import { Trophy, Award, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { ShareButton } from './ShareButton';
import { COURSE_COMPLETION_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import styles from './CourseCompletionCelebration.module.css';

export interface CourseCompletionCelebrationProps {
  /** The name of the course that was completed. */
  courseName: string;
  /** Route slug of the course, so the share link points at its public page. */
  courseSlug: string;
  /** The total number of lessons in the course. */
  totalLessons: number;
  /** Optional callback run when the "Back to My Courses" link is clicked. */
  onBackToDashboard?: () => void;
  /** Optional callback to dismiss the celebration */
  onDismiss?: () => void;
  /** Optional className to apply to the root element. */
  className?: string;
}

/**
 * A full-screen celebration component displayed when a student completes a course.
 * It features a congratulatory message, course details, and celebratory animations.
 */
export const CourseCompletionCelebration: React.FC<CourseCompletionCelebrationProps> = ({
  courseName,
  courseSlug,
  totalLessons,
  onBackToDashboard,
  onDismiss,
  className,
}) => {
  return (
    <div className={`${styles.overlay} ${className || ''}`}>
      <div className={styles.confettiContainer}>
        {/* Generate multiple confetti pieces with different animations */}
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className={styles.confetti} />
        ))}
      </div>
      <div className={styles.contentCard}>
        {onDismiss && (
          <button className={styles.closeButton} onClick={onDismiss} aria-label="Close celebration">
            <X size={24} />
          </button>
        )}
        <div className={styles.iconContainer}>
          <Trophy className={styles.trophyIcon} size={64} />
        </div>
        <h1 className={styles.title}>Congratulations!</h1>
        <p className={styles.description}>
          You've successfully completed the course:
          <br />
          <strong>{courseName}</strong>
        </p>
        <div className={styles.stats}>
          <span className={styles.statItem}>100% complete</span>
          <span className={styles.statItem}>
            {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'} finished
          </span>
        </div>
        <div className={styles.actions}>
          <Button size="lg" asChild className={styles.primaryAction}>
            <Link to="/student/certificates">
              <Award size={20} />
              Get your certificate
            </Link>
          </Button>
          <div className={`${styles.secondaryActions} ${onDismiss ? '' : styles.single}`}>
            <Button size="lg" variant="outline" asChild onClick={onBackToDashboard}>
              <Link to="/student/courses">Back to My Courses</Link>
            </Button>
            {onDismiss && (
              <Button size="lg" variant="outline" onClick={onDismiss}>
                Continue learning
              </Button>
            )}
          </div>
          <ShareButton
            className={styles.shareAction}
            kind="course"
            handle={courseSlug}
            title={courseName}
            campaign={COURSE_COMPLETION_SHARE_CAMPAIGN}
            label="Share achievement"
            heading="Share your achievement"
            message={`I just finished ${courseName} on Testkart`}
            variant="ghost"
            size="lg"
          />
        </div>
      </div>
    </div>
  );
};