import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star, GraduationCap } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import type { PackageDetails } from '../endpoints/tests/details_GET.schema';
import styles from './TestPackageHero.module.css';

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

interface TestPackageHeroProps {
  className?: string;
  testPackage: PackageDetails;
}

export const TestPackageHero: React.FC<TestPackageHeroProps> = ({ className, testPackage }) => {
  const isBestseller = testPackage.studentsEnrolled > 500 || (testPackage.rating && testPackage.rating > 4.5);
  const examName = testPackage.examName && testPackage.examName !== 'Unspecified' ? testPackage.examName : null;
  const rating = testPackage.rating ? Number(testPackage.rating) : null;

  return (
    <div className={`${styles.hero} ${className || ''}`}>
      <span className={`${styles.blob} ${styles.blobPeach}`} aria-hidden="true" />
      <span className={`${styles.blob} ${styles.blobLavender}`} aria-hidden="true" />

      <div className={styles.heroContent}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/mock-test">Mock Tests</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className={styles.breadcrumbCurrent}>{testPackage.title}</span>
        </nav>

        <div className={styles.heroMain}>
          {(examName || isBestseller) && (
          <div className={styles.badgesRow}>
            {examName && (
              testPackage.examSlug ? (
                <Link to={`/exams/${testPackage.examSlug}`} className={styles.examPill}>
                  <GraduationCap size={14} aria-hidden="true" />
                  {examName}
                </Link>
              ) : (
                <span className={styles.examPill}>
                  <GraduationCap size={14} aria-hidden="true" />
                  {examName}
                </span>
              )
            )}
            {isBestseller && <span className={styles.bestsellerPill}>Bestseller</span>}
          </div>
          )}

          <h1 className={styles.heroTitle}>{testPackage.title}</h1>
          <p className={styles.heroSubtitle}>
            {testPackage.description || `Complete test series for ${examName || 'exam'} preparation with detailed solutions and performance analytics.`}
          </p>

          <div className={styles.heroMeta}>
            {rating !== null && (
              <span className={styles.ratingPill}>
                <span className={styles.ratingNumber}>{rating.toFixed(1)}</span>
                <span className={styles.stars} aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={14} fill={star <= Math.round(rating) ? 'currentColor' : 'none'} />
                  ))}
                </span>
                <button
                  onClick={() => scrollToSection('reviews')}
                  className={styles.reviewsCount}
                  type="button"
                  aria-label={`${rating.toFixed(1)} out of 5 from ${testPackage.reviewsCount} reviews - jump to reviews`}
                >
                  {testPackage.reviewsCount.toLocaleString()} reviews
                </button>
              </span>
            )}
            <span className={styles.hostPill}>
              <span className={styles.hostLabel}>Created by</span>
              <button
                onClick={() => scrollToSection('teacher-profile')}
                className={styles.creatorLink}
                type="button"
                aria-label={`${testPackage.teacherName} - jump to the instructor profile`}
              >
                {testPackage.teacherName}
              </button>
              <VerifiedBadge isVerified={testPackage.teacherIsVerified} size="sm" className={styles.verified} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
