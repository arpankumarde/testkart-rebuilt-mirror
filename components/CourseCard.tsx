import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Users, IndianRupee, BarChart3, Plus, Globe, Eye } from 'lucide-react';
import type { CourseListItem } from '../endpoints/courses/list_GET.schema';
import { Badge } from './Badge';
import { Button } from './Button';
import { useAddToCartMutation } from '../helpers/useCartQuery';
import { useAuth } from '../helpers/useAuth';
import { VideoPreview } from './VideoPreview';
import { VerifiedBadge } from "./VerifiedBadge";
import { Placeholder } from '../helpers/placeholderImages';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: CourseListItem;
  className?: string;
}

const levelDisplay: Record<CourseListItem['level'], { text: string; icon: React.ReactNode }> = {
  beginner: { text: 'Beginner', icon: <BarChart3 size={16} style={{ transform: 'rotate(90deg) scaleX(-1)' }} /> },
  intermediate: { text: 'Intermediate', icon: <BarChart3 size={16} style={{ transform: 'rotate(90deg) scaleX(-1)' }} /> },
  advanced: { text: 'Advanced', icon: <BarChart3 size={16} style={{ transform: 'rotate(90deg) scaleX(-1)' }} /> },
};

export const CourseCard: React.FC<CourseCardProps> = ({ course, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const addToCartMutation = useAddToCartMutation();

  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";
  const detailsUrl = `/course/${course.slug}`;

  const isFree = course.price === 0;
  const formattedPrice = isFree
    ? 'Free'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
      }).format(course.price);

  const levelInfo = levelDisplay[course.level] || { text: course.level, icon: <BarChart3 size={16} /> };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't add to cart if user is a teacher
    if (isTeacher) {
      return;
    }

    // Check if user is authenticated
    if (authState.type !== "authenticated") {
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Call the mutation
    addToCartMutation.mutate({ courseId: course.id });
  };



  const handleTeacherClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/expert/${course.teacherSlug}`);
  };

  return (
    <Link to={detailsUrl} className={`${styles.cardLink} ${className || ''}`}>
      <div className={styles.card}>
        {course.category && (
          <div className={styles.badgeContainer}>
            <Badge variant="default">{course.category}</Badge>
          </div>
        )}
        
        <div className={styles.thumbnailWrapper}>
          <VideoPreview
            videoUrl={course.introVideoUrl || course.thumbnailUrl}
            thumbnailUrl={course.thumbnailImageUrl || Placeholder.COURSE}
            title={course.title}
            className={styles.thumbnail}
          />

          {/* Quick Add to Cart Button - Hidden for teachers and free courses */}
          {!isTeacher && !isFree && (
            <Button
              size="icon-md"
              variant="primary"
              className={styles.quickAddButton}
              onClick={handleAddToCart}
              disabled={addToCartMutation.isPending}
              aria-label="Add to cart"
            >
              {addToCartMutation.isPending ? (
                <div className={styles.spinner} />
              ) : (
                <Plus size={20} />
              )}
            </Button>
          )}
        </div>

        <div className={styles.cardContent}>
          <h3 className={styles.title}>{course.title}</h3>
          <p className={styles.creator}>
            By:{' '}
            <span
              className={styles.teacherLink}
              onClick={handleTeacherClick}
            >
              {course.teacherName}
            </span>
            {' '}<VerifiedBadge isVerified={course.teacherIsVerified} size="sm" />
          </p>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <div className={styles.infoIcon}>{levelInfo.icon}</div>
              <span>{levelInfo.text}</span>
            </div>
                        {/* Students count - hidden for now */}
            {false && <div className={styles.infoItem}>
              <div className={styles.infoIcon}><Users size={16} /></div>
              <span>{course.enrollmentCount.toLocaleString()} Students</span>
            </div>}
            <div className={styles.infoItem}>
              <div className={styles.infoIcon}><Eye size={16} /></div>
              <span>{(course.views ?? 0).toLocaleString()} Views</span>
            </div>
            {course.language && (
              <div className={styles.infoItem}>
                <div className={styles.infoIcon}><Globe size={16} /></div>
                <span>{course.language}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.cardFooter}>
          {!isTeacher && (
            <div className={`${styles.enrollButton} ${isFree ? styles.freeButton : ''}`}>
              <BookOpen size={18} />
              <span>{isFree ? 'Enroll Free' : 'Buy Now'}</span>
            </div>
          )}
          {isTeacher ? (
            <div className={styles.teacherText}>
              For Students Only
            </div>
          ) : (
            <div className={styles.priceContainer}>
              <div className={`${styles.price} ${isFree ? styles.freePrice : ''}`}>
                {!isFree && <IndianRupee size={20} />}
                <span>{isFree ? 'Free' : formattedPrice.replace('₹', '')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};