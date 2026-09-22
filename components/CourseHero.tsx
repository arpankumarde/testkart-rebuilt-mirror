import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Users, Clock, Award, BookOpen } from 'lucide-react';
import { Badge } from './Badge';
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
  category: string | null;
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
  const totalLessons = course.sections?.reduce((sum, section) => sum + section.lessons.length, 0) || 0;
  
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      const hoursText = hours === 1 ? '1 hour' : `${hours} hours`;
      if (remainingMinutes > 0) {
        const minutesText = remainingMinutes === 1 ? '1 minute' : `${remainingMinutes} minutes`;
        return `${hoursText} ${minutesText}`;
      }
      return hoursText;
    }
    
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  };
  
  const handleScrollToInstructor = () => {
    const instructorElement = document.getElementById('instructor-profile');
    if (instructorElement) {
      instructorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getLevelColor = () => {
    switch (course.level) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'secondary';
    }
  };

  return (
    <div className={`${styles.hero} ${className || ''}`}>
      <div className={styles.heroContent}>
        <nav className={styles.breadcrumb}>
          <Link to="/course">Courses</Link>
          <ChevronRight size={14} />
          <span>{course.title}</span>
        </nav>

        <div className={styles.heroMain}>
          <div>
            <h1 className={styles.heroTitle}>{course.title}</h1>
            


            <div className={styles.heroMeta}>
              <div className={styles.metaItem}>
                <Badge variant={getLevelColor() as any} className={styles.levelBadge}>
                  <Award size={14} />
                  {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                </Badge>
              </div>
              <div className={styles.metaItem}>
                <span>Course hosted by</span>
                <button 
                  onClick={handleScrollToInstructor}
                  className={styles.creatorLink}
                  type="button"
                  aria-label="Scroll to instructor profile section"
                >
                  {course.teacher.displayName}
                </button>
                <VerifiedBadge isVerified={course.teacher.isVerified} size="sm" />
              </div>
            </div>

            
          </div>
        </div>
      </div>
    </div>
  );
};