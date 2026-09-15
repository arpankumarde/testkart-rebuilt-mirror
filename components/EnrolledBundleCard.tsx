import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, BookCopy, Award, Clock, FileText, Package } from 'lucide-react';
import { Progress } from './Progress';
import { Button } from './Button';
import { Placeholder } from '../helpers/placeholderImages';
import type { EnrolledBundle } from '../endpoints/student/bundles/enrolled_GET.schema';
import styles from './EnrolledBundleCard.module.css';

interface EnrolledBundleCardProps {
  bundle: EnrolledBundle;
  className?: string;
}

export const EnrolledBundleCard: React.FC<EnrolledBundleCardProps> = ({ bundle, className }) => {
  const overallCompletion = useMemo(() => {
    if (bundle.courses.length === 0) {
      return 0;
    }
    const totalPercentage = bundle.courses.reduce(
      (sum, course) => sum + (course.completionPercentage || 0),
      0
    );
    return totalPercentage / bundle.courses.length;
  }, [bundle.courses]);

  const isCompleted = overallCompletion >= 100;

  const totalItems = bundle.courses.length + bundle.mockTests.length + bundle.digitalProducts.length;

  const lastAccessedCourse = useMemo(() => {
    return [...bundle.courses]
      .filter(c => c.lastAccessedAt)
      .sort((a, b) => new Date(b.lastAccessedAt!).getTime() - new Date(a.lastAccessedAt!).getTime())[0];
  }, [bundle.courses]);

  const firstIncompleteCourse = useMemo(() => {
    return bundle.courses.find(c => (c.completionPercentage || 0) < 100) || bundle.courses[0];
  }, [bundle.courses]);

    const continueLearningUrl = firstIncompleteCourse
    ? `/student/courses/${firstIncompleteCourse.id}`
    : bundle.mockTests.length > 0
      ? `/mock-test/${bundle.mockTests[0].slug}`
      : bundle.digitalProducts.length > 0
        ? '/student/shop'
        : '/student/dashboard';
  
  const ctaText = useMemo(() => {
    if (bundle.courses.length > 0) {
      return isCompleted ? 'Review Bundle' : 'Continue Learning';
    }
    if (bundle.mockTests.length > 0) {
      return 'Go to Tests';
    }
    if (bundle.digitalProducts.length > 0) {
      return 'Go to Notes';
    }
    return 'View Bundle';
  }, [bundle.courses.length, bundle.mockTests.length, bundle.digitalProducts.length, isCompleted]);

  return (
    <div className={`${styles.card} ${className || ''}`}>
      <div className={styles.cardHeader}>
        <img
          src={bundle.thumbnailUrl || Placeholder.TEST}
          alt={bundle.title}
          className={styles.thumbnail}
        />
        <div className={styles.headerContent}>
          <h3 className={styles.title}>{bundle.title}</h3>
          <p className={styles.creator}>By: {bundle.teacherName}</p>
          <div className={styles.headerMeta}>
            <div className={styles.itemCount}>
              <Package size={14} />
              <span>{totalItems} items</span>
            </div>
            {isCompleted && (
              <div className={`${styles.metaItem} ${styles.certificateBadge}`}>
                <Award size={16} />
                <span>Certificate Eligible</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.cardContent}>
        {bundle.courses.length > 0 && (
          <div className={styles.overallProgress}>
            <div className={styles.progressHeader}>
              <span>Courses Progress</span>
              <span className={styles.progressText}>{Math.round(overallCompletion)}%</span>
            </div>
            <Progress value={overallCompletion} className={styles.progressBar} />
          </div>
        )}

        {bundle.courses.length > 0 && (
          <div className={styles.courseList}>
            <h4>Courses</h4>
            {bundle.courses.map(course => (
              <Link to={`/student/courses/${course.id}`} key={course.id} className={styles.courseItem}>
                <div className={styles.courseInfo}>
                  <BookCopy size={16} className={styles.courseIcon} />
                  <span className={styles.courseTitle}>{course.title}</span>
                </div>
                <div className={styles.courseProgress}>
                  <Progress value={course.completionPercentage || 0} className={styles.courseProgressBar} />
                  <span className={styles.courseProgressText}>{Math.round(course.completionPercentage || 0)}%</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {bundle.mockTests.length > 0 && (
          <div className={styles.courseList}>
            <h4>Mock Tests</h4>
            {bundle.mockTests.map(test => (
                            <Link to={`/mock-test/${test.slug}`} key={test.id} className={styles.courseItem}>
                <div className={styles.courseInfo}>
                  <BookCopy size={16} className={styles.courseIcon} />
                  <span className={styles.courseTitle}>{test.title}</span>
                  {test.isEnrolled && <span className={styles.badge}>Enrolled</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {bundle.digitalProducts.length > 0 && (
          <div className={styles.courseList}>
            <h4>Study Notes</h4>
            {bundle.digitalProducts.map(product => (
              <Link to="/student/shop" key={product.id} className={styles.courseItem}>
                <div className={styles.courseInfo}>
                  <FileText size={16} className={styles.courseIcon} />
                  <span className={styles.courseTitle}>{product.title}</span>
                  {product.isPurchased && <span className={styles.badge}>Purchased</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        {lastAccessedCourse?.lastAccessedAt && (
          <div className={styles.metaItem}>
            <Clock size={14} />
            <span>Last accessed: {new Date(lastAccessedCourse.lastAccessedAt).toLocaleDateString()}</span>
          </div>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to={continueLearningUrl}>
            <PlayCircle size={16} />
            {ctaText}
          </Link>
        </Button>
      </div>
    </div>
  );
};