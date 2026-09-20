import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTeacherCourseDetailsQuery, useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { ConsoleConfirmDialog } from './ConsoleConfirmDialog';
import { AlertCircle, CheckCircle, BookOpen, List, FileText, Eye, AlertTriangle, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import styles from './CoursePublishReview.module.css';

interface CoursePublishReviewProps {
  courseId: number;
  onPublishSuccess?: () => void;
}

const CoursePublishReviewSkeleton: React.FC = () => (
  <div className={styles.container}>
    <div className={styles.card}>
      <Skeleton style={{ height: '2rem', width: '60%', marginBottom: 'var(--spacing-4)' }} />
      <div className={styles.summaryGrid}>
        <Skeleton style={{ height: '1.5rem', width: '120px' }} />
        <Skeleton style={{ height: '1.5rem', width: '200px' }} />
        <Skeleton style={{ height: '1.5rem', width: '120px' }} />
        <Skeleton style={{ height: '1.5rem', width: '200px' }} />
        <Skeleton style={{ height: '1.5rem', width: '120px' }} />
        <Skeleton style={{ height: '1.5rem', width: '200px' }} />
      </div>
    </div>
    <div className={styles.card}>
      <Skeleton style={{ height: '2rem', width: '40%', marginBottom: 'var(--spacing-4)' }} />
      <Skeleton style={{ height: '1.5rem', width: '80%' }} />
      <Skeleton style={{ height: '1.5rem', width: '70%', marginTop: 'var(--spacing-2)' }} />
    </div>
    <div className={styles.actions}>
      <Skeleton style={{ height: '3rem', width: '120px' }} />
      <Skeleton style={{ height: '3rem', width: '120px' }} />
    </div>
  </div>
);

export const CoursePublishReview: React.FC<CoursePublishReviewProps> = ({ courseId, onPublishSuccess }) => {
  const navigate = useNavigate();
  const { data: course, isPending, error } = useTeacherCourseDetailsQuery(courseId);
  const { publishCourseMutation, unpublishCourseMutation } = useTeacherCourseMutations();
  const [isUnpublishOpen, setUnpublishOpen] = useState(false);

  const isPublished = course?.status === 'published';
  const isInReview = !isPublished && !!course?.inReview;
  const totalLessons = course?.sections.reduce((acc, section) => acc + section.lessons.length, 0) ?? 0;
  const hasSections = (course?.sections.length ?? 0) > 0;
  const hasLessons = totalLessons > 0;
  const isPublishable = hasSections && hasLessons;

  // Both mutations toast their own success and error, so these handlers add none.
  const handlePublish = () => {
    if (!isPublishable) return;
    publishCourseMutation.mutate({ courseId }, { onSuccess: () => onPublishSuccess?.() });
  };

  const handleUnpublish = () => {
    unpublishCourseMutation.mutate(
      { courseId },
      {
        onSuccess: () => {
          setUnpublishOpen(false);
          onPublishSuccess?.();
        },
      }
    );
  };

  const handleKeepDraft = () => {
    toast.info('Course kept as a draft. Curriculum changes are saved as you make them.');
    navigate('/teacher/courses');
  };

  // Gate on data, not isFetching, so a background refresh never blanks the review.
  if (!course) {
    if (isPending) {
      return <CoursePublishReviewSkeleton />;
    }
    return (
      <div className={`${styles.card} ${styles.errorCard}`} role="alert">
        <AlertCircle />
        <p>{error ? `Error loading course details: ${error.message}` : 'Course not found.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        <h2 className={styles.title}>
          {isPublished
            ? 'Manage Your Published Course'
            : isInReview
            ? 'Your course is in review'
            : 'Review and submit your course'}
        </h2>
        <p className={styles.subtitle}>
          {isPublished
            ? 'Your course is currently live and available to students.'
            : isInReview
            ? 'Our team is reviewing your course. Students can find and enroll in it once it is approved, and we will email you when it is approved or needs changes.'
            : 'This is a preview of your course. Check every detail, then submit it for review. Students can find it once our team approves it.'}
        </p>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Course Summary</h3>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryLabel}><BookOpen size={16} /> Title</div>
          <div className={styles.summaryValue}>{course.title}</div>

          <div className={styles.summaryLabel}><List size={16} /> Category</div>
          <div className={styles.summaryValue}>{course.category}</div>

          <div className={styles.summaryLabel}><FileText size={16} /> Description</div>
          <div className={styles.summaryValue} dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.description) }} />
        </div>
      </div>

      {isPublished ? (
        <div className={`${styles.card} ${styles.publishedStatusCard}`}>
          <div className={styles.publishedBadge}>
            <CheckCircle size={20} />
            <span>Course is Published</span>
          </div>
          <p className={styles.publishedInfo}>
            This course is currently live on the platform. Students can enroll and access the content.
            You have <strong>{course.sections.length}</strong> section(s) with <strong>{totalLessons}</strong> lesson(s).
          </p>
        </div>
      ) : (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Validation Checks</h3>
          <ul className={styles.validationList}>
            <li className={hasSections ? styles.valid : styles.invalid}>
              {hasSections ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span>Course has at least one section.</span>
              <span className={styles.validationCount}>({course.sections.length} sections)</span>
            </li>
            <li className={hasLessons ? styles.valid : styles.invalid}>
              {hasLessons ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span>Course has at least one lesson.</span>
              <span className={styles.validationCount}>({totalLessons} lessons)</span>
            </li>
          </ul>
          {!isPublishable && (
            <p className={styles.validationErrorText}>
              Please go back to the "Curriculum" step to add content before you can submit it for review.
            </p>
          )}
        </div>
      )}

      {isPublished && (
        <div className={`${styles.card} ${styles.warningCard}`}>
          <div className={styles.warningHeader}>
            <AlertTriangle size={20} />
            <h4>Unpublish Course</h4>
          </div>
          <p className={styles.warningText}>
            Unpublishing will move this course back to draft status. It will no longer be visible to students
            or available for enrollment, and it is removed from every student's cart. Existing enrollments
            remain, but new students cannot enroll until you publish it again.
          </p>
        </div>
      )}

      <div className={styles.actions}>
        {isPublished ? (
          <>
            <Button
              variant="outline"
              onClick={() => navigate('/teacher/courses')}
            >
              Back to Courses
            </Button>
            <Button asChild variant="outline">
              <Link to={`/course/${course.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye size={16} />
                View Published Course
              </Link>
            </Button>
            <Button
              variant="destructive"
              onClick={() => setUnpublishOpen(true)}
              disabled={unpublishCourseMutation.isPending}
            >
              {unpublishCourseMutation.isPending ? 'Unpublishing...' : 'Unpublish Course'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={handleKeepDraft}>
              Keep as Draft
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!isPublishable || isInReview || publishCourseMutation.isPending}
            >
              {publishCourseMutation.isPending
                ? 'Submitting...'
                : isInReview
                ? 'In review'
                : 'Submit for review'}
            </Button>
          </>
        )}
      </div>

      <ConsoleConfirmDialog
        open={isUnpublishOpen}
        onOpenChange={(open) => {
          if (!unpublishCourseMutation.isPending) setUnpublishOpen(open);
        }}
        tone="destructive"
        icon={<EyeOff size={20} />}
        title="Unpublish this course?"
        description={
          <>
            <strong>{course.title}</strong> goes back to draft. It disappears from the marketplace and is removed
            from every student's cart. Enrolled students keep access.
          </>
        }
        confirmLabel="Unpublish"
        pendingLabel="Unpublishing..."
        isPending={unpublishCourseMutation.isPending}
        onConfirm={handleUnpublish}
      />
    </div>
  );
};
