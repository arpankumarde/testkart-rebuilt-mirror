import React, { useState } from 'react';
import { CheckCircle, Share2, Info } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../helpers/useAuth';
import { useCartItemsQuery, useAddToCartMutation } from '../helpers/useCartQuery';
import { useCourseEnrollment } from '../helpers/useCourseEnrollment';
import { Button } from './Button';
import { VideoPreview } from './VideoPreview';
import { PurchaseCardTeacher } from './PurchaseCardTeacher';
import { ShareAssetDialog } from './ShareAssetDialog';
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { courseDiscountPrice } from '../helpers/coursePricing';
import styles from './CourseSidebar.module.css';

export type PublicCourseDetails = {
  id: number;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  thumbnailImageUrl: string | null;
  introVideoUrl?: string | null;
  price: number;
  discountPrice?: number | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  estimatedDurationMinutes: number | null;
  teacher: {
    id: number;
    displayName: string;
    profilePicture: string | null;
    bio?: string | null;
    slug: string;
    isVerified: boolean;
    academyName?: string | null;
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
  
  // Check if this course is already in the cart
  const isInCart = !isFree && cartQuery.data?.items.some(item => item.type === 'course' && item.courseId === course.id);

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

  const formatInr = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  const discountPrice = isFree ? null : courseDiscountPrice(course.price, course.discountPrice);
  const hasDiscount = discountPrice !== null;
  const formattedPrice = isFree ? "Free" : formatInr(discountPrice ?? course.price);
  const formattedOriginalPrice = hasDiscount ? formatInr(course.price) : null;
  const discountPercentage = hasDiscount
    ? Math.round(((course.price - discountPrice) / course.price) * 100)
    : 0;

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
            </>
          ) : (
            <>
              {!isFree && (
                <div className={styles.pricing}>
                  <div className={styles.priceRow}>
                    <span className={styles.currentPrice}>{formattedPrice}</span>
                    {formattedOriginalPrice && (
                      <>
                        <span className={styles.originalPrice}>{formattedOriginalPrice}</span>
                        <span className={styles.discount}>{discountPercentage}% off</span>
                      </>
                    )}
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
            </>
          )}
        </div>

        <PurchaseCardTeacher
          label="Hosted by"
          name={course.teacher.displayName}
          avatarUrl={course.teacher.profilePicture}
          slug={course.teacher.slug}
          isVerified={course.teacher.isVerified}
          academyName={course.teacher.academyName}
        />

        <button
          type="button"
          className={styles.shareBar}
          onClick={() => setShareOpen(true)}
        >
          <Share2 size={18} aria-hidden="true" />
          Share this course
        </button>
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