import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Users, Calendar, Globe, Star, Clock, BookOpen, GraduationCap } from 'lucide-react';
import { Badge } from './Badge';
import { VerifiedBadge } from './VerifiedBadge';
import type { PackageDetails } from '../endpoints/tests/details_GET.schema';
import { VideoPreview } from "./VideoPreview";
import styles from './TestPackageHero.module.css';

const StarRating: React.FC<{ rating: number; reviewsCount: number }> = ({ rating, reviewsCount }) => {
  const handleScrollToReviews = () => {
    const reviewsElement = document.getElementById('reviews');
    if (reviewsElement) {
      reviewsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={styles.rating}>
      <span className={styles.ratingNumber}>{rating.toFixed(1)}</span>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            fill={star <= Math.round(rating) ? "currentColor" : "none"}
            className={styles.starIcon}
          />
        ))}
      </div>
      <button 
        onClick={handleScrollToReviews}
        className={styles.reviewsCount}
        type="button"
        aria-label="Scroll to reviews section"
      >
        ({reviewsCount.toLocaleString()} reviews)
      </button>
    </div>
  );
};

interface TestPackageHeroProps {
  className?: string;
  testPackage: PackageDetails;
  totalQuestions?: number;
  totalDurationMinutes?: number;
}

export const TestPackageHero: React.FC<TestPackageHeroProps> = ({ className, testPackage, totalQuestions, totalDurationMinutes }) => {
  const isBestseller = testPackage.studentsEnrolled > 500 || (testPackage.rating && testPackage.rating > 4.5);

  const handleScrollToTeacher = () => {
    const teacherElement = document.getElementById('teacher-profile');
    if (teacherElement) {
      teacherElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={`${styles.hero} ${className || ''}`}>
      <div className={styles.heroContent}>
        <nav className={styles.breadcrumb}>
          <Link to="/mock-test">Mock Tests</Link>
          <ChevronRight size={14} />
          <span>{testPackage.title}</span>
        </nav>

        <div className={styles.heroMain}>
          <div>
            <div className={styles.badgesRow}>
              {isBestseller && (
                <Badge variant="warning" className={styles.bestsellerBadge}>
                  Bestseller
                </Badge>
              )}
            </div>
            <h1 className={styles.heroTitle}>{testPackage.title}</h1>
            <p className={styles.heroSubtitle}>
              {testPackage.description || `Complete test series for ${testPackage.examName || 'exam'} preparation with detailed solutions and performance analytics.`}
            </p>

            <div className={styles.heroMeta}>
              {testPackage.examName && (
                <div className={styles.metaItem}>
                  <GraduationCap size={16} />
                  <span>
                    Exam:{' '}
                    {testPackage.examSlug ? (
                      <Link to={`/exams/${testPackage.examSlug}`} className={styles.creatorLink}>
                        {testPackage.examName}
                      </Link>
                    ) : (
                      <span className={styles.creatorLink}>{testPackage.examName}</span>
                    )}
                  </span>
                </div>
              )}
              {testPackage.rating && (
                <StarRating rating={testPackage.rating} reviewsCount={testPackage.reviewsCount} />
              )}
              {!!totalQuestions && totalQuestions > 0 && (
                <div className={styles.metaItem}>
                  <BookOpen size={16} />
                  <span>{totalQuestions} Questions</span>
                </div>
              )}
              {totalDurationMinutes !== undefined && totalDurationMinutes !== null && (
                <div className={styles.metaItem}>
                  <Clock size={16} />
                  <span>{totalDurationMinutes > 0 ? `${totalDurationMinutes} Minutes` : "No Time Limit"}</span>
                </div>
              )}
                            {testPackage.studentsEnrolled > 1 && (
                <div className={styles.metaItem}>
                  <Users size={16} />
                  <span>{testPackage.studentsEnrolled.toLocaleString()} students enrolled</span>
                </div>
              )}
              <div className={styles.metaItem}>
                <span>Created by</span>
                <button 
                  onClick={handleScrollToTeacher}
                  className={styles.creatorLink}
                  type="button"
                  aria-label="Scroll to teacher profile section"
                >
                  {testPackage.teacherName}
                </button>
                <VerifiedBadge isVerified={testPackage.teacherIsVerified} size="sm" />
              </div>
            </div>

            <div className={styles.heroInfo}>
              {testPackage.updatedAt && (
                <div className={styles.infoItem}>
                  <Calendar size={14} />
                  <span>Last updated {new Date(testPackage.updatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
              )}
              <div className={styles.infoItem}>
                <Globe size={14} />
                <span>{testPackage.language || 'English'}</span>
              </div>
            </div>
            
                        
          </div>
        </div>
      </div>
    </div>
  );
};