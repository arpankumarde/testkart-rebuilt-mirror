import React, { useState } from 'react';
import { CheckCircle, Share2, Info, FileText, Gift, BookOpen, Languages } from 'lucide-react';
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
import { PurchaseCardTeacher } from './PurchaseCardTeacher';
import type { PackageDetails } from '../endpoints/tests/details_GET.schema';
import { formatLanguages } from '../helpers/itemLanguages';
import styles from './TestPackageSidebar.module.css';

interface TestPackageSidebarProps {
  className?: string;
  testPackage: PackageDetails;
  totalQuestions?: number;
}

export const TestPackageSidebar: React.FC<TestPackageSidebarProps> = ({ className, testPackage, totalQuestions }) => {
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

  const includes: Array<{ icon: React.ReactNode; label: string }> = [];
  if (testPackage.totalTests > 0) {
    includes.push({
      icon: <FileText size={16} />,
      label: `${testPackage.totalTests} ${testPackage.totalTests === 1 ? 'mock test' : 'mock tests'}`,
    });
  }
  if (testPackage.freeTestsCount > 0 && !isFree) {
    includes.push({
      icon: <Gift size={16} />,
      label: `${testPackage.freeTestsCount} free ${testPackage.freeTestsCount === 1 ? 'test' : 'tests'}`,
    });
  }
  if (totalQuestions && totalQuestions > 0) {
    includes.push({ icon: <BookOpen size={16} />, label: `${totalQuestions} questions` });
  }
  includes.push({ icon: <Languages size={16} />, label: formatLanguages(testPackage) || 'English' });

  return (
    <div className={`${styles.sidebar} ${className || ''}`}>
      <div className={styles.sidebarCard}>
          <div className={styles.media}>
            <div className={styles.mediaFrame}>
              {testPackage.introVideoUrl ? (
                <VideoPreview
                  videoUrl={testPackage.introVideoUrl}
                  thumbnailUrl={testPackage.thumbnailUrl}
                  title={testPackage.title}
                  inlinePlayback={true}
                />
              ) : (
                <div className={styles.preview}>
                  <img
                    src={testPackage.thumbnailUrl || Placeholder.TEST}
                    alt={testPackage.title}
                    className={styles.previewImage}
                  />
                </div>
              )}
            </div>
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
                  {isFree && <p className={styles.priceNote}>Every test in this series is free to attempt.</p>}
                </div>

                <div className={styles.ctaButtons}>
                  {isFree ? (
                    <Button
                      size="lg"
                      className={styles.primaryCta}
                      onClick={handleAddToCart}
                      disabled={freeEnrollmentMutation.isPending}
                    >
                      {freeEnrollmentMutation.isPending ? 'Enrolling...' : 'Enroll Now'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        className={styles.primaryCta}
                        onClick={handleAddToCart}
                        disabled={isInCart ? false : addToCartMutation.isPending}
                      >
                        {isInCart ? 'Go to Cart' : (addToCartMutation.isPending ? 'Adding...' : 'Add to cart')}
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className={styles.secondaryCta}
                        onClick={handleBuyNow}
                        disabled={isInCart ? false : addToCartMutation.isPending}
                      >
                        {isInCart ? 'Checkout' : (addToCartMutation.isPending ? 'Processing...' : 'Buy now')}
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {includes.length > 0 && (
              <div className={styles.includes}>
                <h3 className={styles.includesTitle}>This test series includes</h3>
                <ul className={styles.includesList}>
                  {includes.map((item) => (
                    <li key={item.label} className={styles.includesItem}>
                      <span className={styles.includesIcon} aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className={styles.hostedBy}>
            <PurchaseCardTeacher
              label="Created by"
              name={testPackage.teacherName}
              avatarUrl={testPackage.teacherAvatarUrl}
              slug={testPackage.teacherSlug}
              isVerified={testPackage.teacherIsVerified}
              academyName={testPackage.teacherAcademyName}
            />
          </div>

          <button
            type="button"
            className={styles.shareBar}
            onClick={() => setShareOpen(true)}
          >
            <Share2 size={18} aria-hidden="true" />
            Share this test series
          </button>
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