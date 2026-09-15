import React, { useState } from 'react';
import { CheckCircle, Share2, Info } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../helpers/useAuth';
import { useAddToCartMutation, useCartItemsQuery } from '../helpers/useCartQuery';
import { useFreeEnrollmentMutation } from '../helpers/useFreeEnrollmentMutation';
import { toast } from 'sonner';
import { Button } from './Button';
import { ShareAssetDialog } from './ShareAssetDialog';
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { Placeholder } from '../helpers/placeholderImages';
import { VideoPreview } from './VideoPreview';
import type { PackageDetails } from '../endpoints/tests/details_GET.schema';
import styles from './TestPackageSidebar.module.css';

interface TestPackageSidebarProps {
  className?: string;
  testPackage: PackageDetails;
}

export const TestPackageSidebar: React.FC<TestPackageSidebarProps> = ({ className, testPackage }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const [isShareOpen, setShareOpen] = useState(false);
  
  // Check if user is a teacher
  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';
  
  const addToCartMutation = useAddToCartMutation();
  const freeEnrollmentMutation = useFreeEnrollmentMutation();
  const cartQuery = useCartItemsQuery();
  const isEnrolled = testPackage.isEnrolled;
  
  // Check if this test is already in the cart (only for paid tests)
  const isFree = Number(testPackage.price) === 0;
  const isInCart = !isFree && cartQuery.data?.items.some(item => item.type === 'test' && item.mockTestId === testPackage.id);

  const handleAddToCart = async () => {
    if (authState.type !== 'authenticated') {
      toast.error(isFree ? 'Please log in to enroll' : 'Please log in to add items to your cart');
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (isFree) {
      try {
        await freeEnrollmentMutation.mutateAsync({ mockTestId: testPackage.id });
        navigate('/student/dashboard');
      } catch (error) {
        console.error('Failed to enroll in free test:', error);
      }
    } else if (isInCart) {
      // If already in cart, navigate to cart page
      navigate('/cart');
    } else {
      try {
        await addToCartMutation.mutateAsync({ mockTestId: testPackage.id });
      } catch (error) {
        console.error('Failed to add item to cart:', error);
      }
    }
  };

  const handleBuyNow = async () => {
    if (authState.type !== 'authenticated') {
      toast.error(isFree ? 'Please log in to start' : 'Please log in to purchase');
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (isFree) {
      try {
        await freeEnrollmentMutation.mutateAsync({ mockTestId: testPackage.id });
        navigate('/student/dashboard');
      } catch (error) {
        console.error('Failed to enroll in free test:', error);
      }
    } else if (isInCart) {
      // If already in cart, navigate to cart page
      navigate('/cart');
    } else {
      try {
        await addToCartMutation.mutateAsync({ mockTestId: testPackage.id });
        navigate('/cart');
      } catch (error) {
        console.error('Failed to add item to cart:', error);
      }
    }
  };
  
  // Check if there's a valid discount price
  const hasDiscount = !isFree && 
                      testPackage.discountPrice !== null && 
                      testPackage.discountPrice > 0 && 
                      testPackage.discountPrice < testPackage.price;
  
  const displayPrice = hasDiscount ? testPackage.discountPrice : testPackage.price;
  
  const formattedPrice = isFree
    ? "Free"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(Number(displayPrice));

  const formattedOriginalPrice = hasDiscount
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(Number(testPackage.price))
    : null;

  const discountPercentage = hasDiscount
    ? Math.round(((testPackage.price - testPackage.discountPrice!) / testPackage.price) * 100)
    : 0;

  return (
    <div className={`${styles.sidebar} ${className || ''}`}>
      <div className={styles.sidebarCard}>
                    <div className={styles.preview}>
            {testPackage.introVideoUrl ? (
              <VideoPreview
                videoUrl={testPackage.introVideoUrl}
                thumbnailUrl={testPackage.thumbnailUrl}
                title={testPackage.title}
                inlinePlayback={true}
              />
            ) : testPackage.thumbnailUrl ? (
              <img src={testPackage.thumbnailUrl} alt={testPackage.title} className={styles.previewImage} />
            ) : (
              <img
                src={Placeholder.TEST}
                alt={testPackage.title}
                className={styles.previewImage}
              />
            )}
          </div>

          <div className={styles.pricingContent}>
            {isTeacher ? (
              <>
                <div className={styles.teacherInfo}>
                  <div className={styles.teacherInfoIcon}>
                    <Info size={24} />
                  </div>
                  <div className={styles.teacherInfoContent}>
                    <h3 className={styles.teacherInfoTitle}>For Students Only</h3>
                    <p className={styles.teacherInfoText}>
                      This test series is designed for students. Teachers cannot enroll in tests.
                    </p>
                  </div>
                </div>

                <div className={styles.features}>
                  <h4 className={styles.featuresTitle}>This package includes:</h4>
                  <ul className={styles.featuresList}>
                    <li><CheckCircle size={16} /> Full lifetime access</li>
                    <li><CheckCircle size={16} /> Access on mobile and desktop</li>
                    <li><CheckCircle size={16} /> Detailed performance analytics</li>
                  </ul>
                </div>

                <Button 
                  variant="outline" 
                  size="lg" 
                  className={styles.shareButton}
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 size={18} />
                  Share this test series
                </Button>
              </>
            ) : isEnrolled ? (
              <>
                <div className={styles.enrolledBanner}>
                  <CheckCircle size={20} />
                  <span>You're enrolled in this test series</span>
                </div>

                <Button 
                  size="lg" 
                  className={styles.enrolledCta}
                  onClick={() => navigate('/student/dashboard')}
                >
                  Go to My Tests
                </Button>

                <div className={styles.features}>
                  <h4 className={styles.featuresTitle}>This package includes:</h4>
                  <ul className={styles.featuresList}>
                    <li><CheckCircle size={16} /> Full lifetime access</li>
                    <li><CheckCircle size={16} /> Access on mobile and desktop</li>
                    <li><CheckCircle size={16} /> Detailed performance analytics</li>
                  </ul>
                </div>

                <Button 
                  variant="outline" 
                  size="lg" 
                  className={styles.shareButton}
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 size={18} />
                  Share this test series
                </Button>
              </>
            ) : (
              <>
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

                <div className={styles.ctaButtons}>
                <Button 
                  size="lg" 
                  className={styles.primaryCta}
                  onClick={handleAddToCart}
                  disabled={isFree ? freeEnrollmentMutation.isPending : (isInCart ? false : addToCartMutation.isPending)}
                >
                  {isFree 
                    ? (freeEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Free')
                    : isInCart
                      ? 'Go to Cart'
                      : (addToCartMutation.isPending ? 'Adding...' : 'Add to cart')
                  }
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className={styles.secondaryCta}
                  onClick={handleBuyNow}
                  disabled={isFree ? freeEnrollmentMutation.isPending : (isInCart ? false : addToCartMutation.isPending)}
                >
                  {isFree 
                    ? (freeEnrollmentMutation.isPending ? 'Starting...' : 'Start Free')
                    : isInCart
                      ? 'Checkout'
                      : (addToCartMutation.isPending ? 'Processing...' : 'Buy now')
                  }
                </Button>
                </div>

                <div className={styles.features}>
                <h4 className={styles.featuresTitle}>This package includes:</h4>
                <ul className={styles.featuresList}>
                  <li><CheckCircle size={16} /> Full lifetime access</li>
                  <li><CheckCircle size={16} /> Access on mobile and desktop</li>
                  <li><CheckCircle size={16} /> Detailed performance analytics</li>
                </ul>
                </div>

                <Button 
                  variant="outline" 
                  size="lg" 
                  className={styles.shareButton}
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 size={18} />
                  Share this test series
                </Button>
              </>
            )}
          </div>
      </div>

      <ShareAssetDialog
        open={isShareOpen}
        onOpenChange={setShareOpen}
        kind="test-series"
        handle={testPackage.slug}
        title={testPackage.title}
        campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
      />
    </div>
  );
};