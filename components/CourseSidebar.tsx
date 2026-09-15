import React, { useState } from 'react';
import { CheckCircle, Clock, Share2, BookOpen, Info } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../helpers/useAuth';
import { useCartItemsQuery, useAddToCartMutation } from '../helpers/useCartQuery';
import { useCourseEnrollment } from '../helpers/useCourseEnrollment';
import { Button } from './Button';
import { VideoPreview } from './VideoPreview';
import { ShareAssetDialog } from './ShareAssetDialog';
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import styles from './CourseSidebar.module.css';

export type PublicCourseDetails = {
  id: number;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  thumbnailImageUrl: string | null;
  introVideoUrl?: string | null;
  price: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  estimatedDurationMinutes: number | null;
  teacher: {
    id: number;
    displayName: string;
    profilePicture: string | null;
    bio?: string | null;
  };
  isEnrolled: boolean;
  studentsEnrolled?: number;
  sections?: Array<{ lessons: Array<any> }>;
};

interface CourseSidebarProps {
  course: PublicCourseDetails;
  /** Route slug for the course. The details payload carries no slug, and a
      share link must point at /course/{slug}, not at the numeric id. */
  slug: string;
  className?: string;
}

export const CourseSidebar: React.FC<CourseSidebarProps> = ({ 
  course, 
  slug,
  className 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const [isShareOpen, setShareOpen] = useState(false);
  
  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';
  
  const { enrollFreeMutation } = useCourseEnrollment();
  const addToCartMutation = useAddToCartMutation();
  const cartQuery = useCartItemsQuery();

  const isFree = course.price === 0;
  const totalLessons = course.sections?.reduce((sum, section) => sum + section.lessons.length, 0) || 0;
  
  // Check if this course is already in the cart
  const isInCart = !isFree && cartQuery.data?.items.some(item => item.type === 'course' && item.courseId === course.id);

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

  const handleAction = async () => {
    // 1. Handle unauthenticated user
    if (authState.type !== 'authenticated') {
      toast.error(isFree ? 'Please log in to enroll' : 'Please log in to add items to your cart');
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    // 2. Handle enrolled user (should have been handled by UI state, but just in case)
    if (course.isEnrolled) {
      navigate(`/student/courses/${course.id}`);
      return;
    }

    // 3. Handle free course enrollment
    if (isFree) {
      try {
        await enrollFreeMutation.mutateAsync({ courseId: course.id });
        toast.success('Enrolled successfully!');
        navigate(`/student/courses/${course.id}`);
      } catch (error) {
        console.error('Failed to enroll in free course:', error);
        toast.error('Failed to enroll. Please try again.');
      }
      return;
    }

    // 4. Handle paid course
    if (isInCart) {
      // If already in cart, navigate to cart page
      navigate('/cart');
    } else {
      // Add to cart
      try {
        await addToCartMutation.mutateAsync({ courseId: course.id });
        // Optionally navigate to cart or let user stay on page. 
        // Based on instructions "If not in cart, show "Add to Cart" and add to cart, then navigate to /cart"
        navigate('/cart'); 
      } catch (error) {
        console.error('Failed to add item to cart:', error);
        // Toast is handled in mutation
      }
    }
  };

  const isProcessing = enrollFreeMutation.isPending || addToCartMutation.isPending;

  const getActionText = () => {
    if (course.isEnrolled) return 'Go to Course';
    
    if (isFree) {
      return enrollFreeMutation.isPending ? 'Enrolling...' : 'Enroll for Free';
    }

    if (isInCart) return 'Go to Cart';

    return addToCartMutation.isPending ? 'Adding...' : 'Add to Cart';
  };

  const formattedPrice = isFree
    ? "Free"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(course.price);

  return (
    <div className={`${styles.sidebar} ${className || ''}`}>
      <div className={styles.sidebarCard}>
        <VideoPreview
          videoUrl={course.introVideoUrl || course.thumbnailUrl}
          thumbnailUrl={course.thumbnailImageUrl}
          title={course.title}
        />

        <div className={styles.pricingContent}>
          {course.isEnrolled ? (
            <>
              <div className={styles.enrolledBanner}>
                <CheckCircle size={20} />
                <span>You're enrolled in this course</span>
              </div>

              <Button 
                size="lg" 
                className={styles.enrolledCta}
                onClick={() => navigate(`/student/courses/${course.id}`)}
              >
                Go to My Courses
              </Button>

              <div className={styles.features}>
                <h4 className={styles.featuresTitle}>This course includes:</h4>
                <ul className={styles.featuresList}>
                  {totalLessons > 0 && (
                    <li><BookOpen size={16} /> {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}</li>
                  )}
                  {course.estimatedDurationMinutes !== null && course.estimatedDurationMinutes > 0 && (
                    <li><Clock size={16} /> {formatDuration(course.estimatedDurationMinutes)} of content</li>
                  )}
                  <li><CheckCircle size={16} /> Full lifetime access</li>
                  <li><CheckCircle size={16} /> Access on mobile and desktop</li>
                  <li><CheckCircle size={16} /> Track your learning progress</li>
                </ul>
              </div>

              <Button 
                variant="outline" 
                size="lg" 
                className={styles.shareButton}
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={18} />
                Share this course
              </Button>
            </>
          ) : isTeacher ? (
            <>
              <div className={styles.teacherInfo}>
                <div className={styles.teacherInfoIcon}>
                  <Info size={24} />
                </div>
                <div className={styles.teacherInfoContent}>
                  <h3 className={styles.teacherInfoTitle}>For Students Only</h3>
                  <p className={styles.teacherInfoText}>
                    This course is designed for students. Teachers cannot enroll in courses.
                  </p>
                </div>
              </div>

              <div className={styles.features}>
                <h4 className={styles.featuresTitle}>This course includes:</h4>
                <ul className={styles.featuresList}>
                  {totalLessons > 0 && (
                    <li><BookOpen size={16} /> {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}</li>
                  )}
                  {course.estimatedDurationMinutes !== null && course.estimatedDurationMinutes > 0 && (
                    <li><Clock size={16} /> {formatDuration(course.estimatedDurationMinutes)} of content</li>
                  )}
                  <li><CheckCircle size={16} /> Full lifetime access</li>
                  <li><CheckCircle size={16} /> Access on mobile and desktop</li>
                  <li><CheckCircle size={16} /> Track your learning progress</li>
                </ul>
              </div>

              <Button 
                variant="outline" 
                size="lg" 
                className={styles.shareButton}
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={18} />
                Share this course
              </Button>
            </>
          ) : (
            <>
              {!isFree && (
                <div className={styles.pricing}>
                  <div className={styles.priceRow}>
                    <span className={styles.currentPrice}>{formattedPrice}</span>
                  </div>
                </div>
              )}

              <div className={styles.ctaButtons}>
                <Button 
                  size="lg" 
                  className={styles.primaryCta}
                  onClick={handleAction}
                  disabled={isProcessing}
                >
                  {getActionText()}
                </Button>
              </div>

              

              <div className={styles.features}>
                <h4 className={styles.featuresTitle}>This course includes:</h4>
                <ul className={styles.featuresList}>
                  {totalLessons > 0 && (
                    <li><BookOpen size={16} /> {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}</li>
                  )}
                  {course.estimatedDurationMinutes !== null && course.estimatedDurationMinutes > 0 && (
                    <li><Clock size={16} /> {formatDuration(course.estimatedDurationMinutes)} of content</li>
                  )}
                  <li><CheckCircle size={16} /> Full lifetime access</li>
                  <li><CheckCircle size={16} /> Access on mobile and desktop</li>
                  <li><CheckCircle size={16} /> Track your learning progress</li>
                </ul>
              </div>

              <Button 
                variant="outline" 
                size="lg" 
                className={styles.shareButton}
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={18} />
                Share this course
              </Button>
            </>
          )}
        </div>
      </div>

      <ShareAssetDialog
        open={isShareOpen}
        onOpenChange={setShareOpen}
        kind="course"
        handle={slug}
        title={course.title}
        campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
      />
    </div>
  );
};