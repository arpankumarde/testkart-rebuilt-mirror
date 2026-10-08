import React from 'react';
import { Award } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import styles from './CourseHero.module.css';

export type PublicCourseDetails = {
  id: number;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  price: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  estimatedDurationMinutes: number | null;
  teacher: {
    id: number;
    displayName: string;
    profilePicture: string | null;
    isVerified: boolean;
  };
  isEnrolled: boolean;
  sections?: Array<{ lessons: Array<any> }>;
};

interface CourseHeroProps {
  course: PublicCourseDetails;
  className?: string;
}

export const CourseHero: React.FC<CourseHeroProps> = ({ course, className }) => {
  const handleScrollToInstructor = () => {
    const instructorElement = document.getElementById('instructor-profile');
    if (instructorElement) {
      instructorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const levelLabel = course.level.charAt(0).toUpperCase() + course.level.slice(1);

  return (
    <div className={`${styles.hero} ${className || ''}`}>
      <span className={`${styles.blob} ${styles.blobSky}`} aria-hidden="true" />
      <span className={`${styles.blob} ${styles.blobMint}`} aria-hidden="true" />

      <div className={styles.heroContent}>
        <div className={styles.heroMain}>
          <span className={styles.kicker}>Course</span>

          <h1 className={styles.heroTitle}>{course.title}</h1>

          <div className={styles.heroMeta}>
            <span className={styles.levelPill} data-level={course.level}>
              <Award size={14} aria-hidden="true" />
              {levelLabel}
            </span>
            <span className={styles.hostPill}>
              <span className={styles.hostLabel}>Hosted by</span>
              <button
                onClick={handleScrollToInstructor}
                className={styles.creatorLink}
                type="button"
                aria-label={`${course.teacher.displayName} - jump to the instructor profile`}
              >
                {course.teacher.displayName}
              </button>
              <VerifiedBadge isVerified={course.teacher.isVerified} size="sm" className={styles.verified} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};