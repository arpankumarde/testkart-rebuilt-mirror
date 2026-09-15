import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, Star, CheckCircle } from 'lucide-react';
import { Badge } from './Badge';
import { Progress } from './Progress';
import { ReviewDialog } from './ReviewDialog';
import { VideoPreview } from './VideoPreview';
import { Placeholder } from '../helpers/placeholderImages';
import type { EnrolledCourse } from '../endpoints/student/enrolled-courses_GET.schema';
import styles from './EnrolledCourseCard.module.css';

interface EnrolledCourseCardProps {
  course: EnrolledCourse;
  className?: string;
}

const getCourseStatus = (
  completionPercentage: number
): { label: string; variant: 'success' | 'warning' | 'outline'; accentVar: string } => {
  if (completionPercentage >= 100) {
    return { label: 'Completed', variant: 'success', accentVar: 'var(--success)' };
  }
  if (completionPercentage > 0) {
    return { label: 'In progress', variant: 'warning', accentVar: 'var(--warning)' };
  }
  return { label: 'Not started', variant: 'outline', accentVar: 'var(--border)' };
};

export const EnrolledCourseCard: React.FC<EnrolledCourseCardProps> = ({ course, className }) => {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const coursePlayerUrl = `/student/courses/${course.id}`;
  const courseStatus = getCourseStatus(course.completionPercentage);

  return (
    <div
      className={`${styles.card} ${className || ''}`}
      style={{ '--card-accent': courseStatus.accentVar } as React.CSSProperties}
    >
      <Link to={coursePlayerUrl} className={styles.cardLink}>
        <div className={styles.thumbnailWrapper}>
          <VideoPreview
            videoUrl={course.introVideoUrl}
            thumbnailUrl={course.thumbnailImageUrl || Placeholder.COURSE}
            title={course.title}
            className={styles.thumbnail}
          />
          <div className={styles.statusBadgeBacking}>
            <Badge variant={courseStatus.variant} className={styles.statusBadge}>
              {courseStatus.label}
            </Badge>
          </div>
        </div>
      </Link>

      <div className={styles.cardContent}>
        <div className={styles.titleRow}>
          <Link to={coursePlayerUrl} className={styles.cardLink}>
            <h3 className={styles.title}>{course.title}</h3>
          </Link>
          {!course.hasReviewed ? (
            <button
              type="button"
              className={styles.reviewIconButton}
              onClick={() => setIsReviewOpen(true)}
              aria-label="Write a review"
              title="Write a review"
            >
              <Star size={16} />
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.reviewIconButton} ${styles.reviewIconButtonActive}`}
              onClick={() => setIsReviewOpen(true)}
              aria-label={`Edit your review (${course.reviewRating ?? 0} stars)`}
              title="Edit your review"
            >
              <Star size={16} fill="currentColor" />
            </button>
          )}
        </div>
        <p className={styles.creator}>By: {course.teacherName}</p>

        <div className={styles.progressContainer}>
          <Progress value={course.completionPercentage} className={styles.progressBar} />
          <span className={styles.progressText}>{Math.round(course.completionPercentage)}% Complete</span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <Link to={coursePlayerUrl} className={styles.continueButton}>
          <PlayCircle size={18} />
          <span>Continue Learning</span>
        </Link>
      </div>

      <ReviewDialog
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        courseId={course.id}
        testPackageTitle={course.title}
        initialRating={course.reviewRating}
        initialReviewText={course.reviewText}
      />
    </div>
  );
};
