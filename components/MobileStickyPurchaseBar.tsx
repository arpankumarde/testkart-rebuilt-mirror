import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../helpers/useAuth';
import { useAddToCartMutation, useCartItemsQuery, CART_QUERY_KEY } from '../helpers/useCartQuery';
import { useFreeEnrollmentMutation } from '../helpers/useFreeEnrollmentMutation';
import { useCourseEnrollment } from '../helpers/useCourseEnrollment';
import { usePurchaseBundleMutation } from '../helpers/useStudentBundles';
import { getBundleRedirectUrl } from '../endpoints/payment/payu/bundle-redirect_GET.schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postShopEnrollFree } from '../endpoints/shop/enroll-free_POST.schema';
import { STUDENT_PURCHASES_QUERY_KEY } from '../helpers/useShopQuery';
import { toast } from 'sonner';
import { Button } from './Button';
import styles from './MobileStickyPurchaseBar.module.css';

export type ProductData = 
  | { type: 'test'; id: number; price: number; discountPrice: number | null; isEnrolled: boolean }
  | { type: 'course'; id: number; price: number; isEnrolled: boolean }
  | { type: 'digitalProduct'; id: number; price: number; isEnrolled: boolean }
  | { type: 'bundle'; id: number; price: number; originalPrice?: number; isEnrolled: boolean; slug?: string }
  | { type: 'liveTest'; id: number; price: number; isEnrolled: boolean; canEnroll?: boolean };

interface MobileStickyPurchaseBarProps {
  product: ProductData;
  isVisible: boolean;
}

export const MobileStickyPurchaseBar: React.FC<MobileStickyPurchaseBarProps> = ({
  product,
  isVisible,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  
  // Cart mutation
  const addToCartMutation = useAddToCartMutation();
  const cartQuery = useCartItemsQuery();

  // Test enrollment
  const freeTestEnrollmentMutation = useFreeEnrollmentMutation();
  
  // Course enrollment
  const { enrollFreeMutation: freeCourseEnrollmentMutation } = useCourseEnrollment();

  // Bundle enrollment
  const bundlePurchaseMutation = usePurchaseBundleMutation();

  // Digital product free enrollment
  const freeDigitalProductEnrollmentMutation = useMutation({
    mutationFn: postShopEnrollFree,
    onSuccess: (data) => {
      toast.success(data.message || "Successfully enrolled!");
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STUDENT_PURCHASES_QUERY_KEY });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to enroll.";
      toast.error(errorMessage);
    }
  });
  
  // Don't show sticky bar for teachers
  if (authState.type === 'authenticated' && authState.user.role === 'teacher') {
    return null;
  }
  
  const isEnrolled = product.isEnrolled;
  const isFree = Number(product.price) === 0;
  
  // Check if item is already in cart (only for paid items)
  const isInCart = !isFree && cartQuery.data?.items.some(item => {
    if (product.type === 'test') {
      return item.type === 'test' && item.mockTestId === product.id;
    } else if (product.type === 'course') {
      return item.type === 'course' && item.courseId === product.id;
    } else if (product.type === 'digitalProduct') {
      return item.type === 'digitalProduct' && item.digitalProductId === product.id;
    }
    return false;
  });

  const handleBuyNow = async () => {
    if (authState.type !== 'authenticated') {
      toast.error(isFree ? 'Please log in to start' : 'Please log in to purchase');
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (isFree) {
      try {
        if (product.type === 'test') {
          await freeTestEnrollmentMutation.mutateAsync({ mockTestId: product.id });
          navigate('/student/dashboard');
        } else if (product.type === 'course') {
          await freeCourseEnrollmentMutation.mutateAsync({ courseId: product.id });
          toast.success("Successfully enrolled in the course!");
          navigate('/student/my-courses');
        } else if (product.type === 'digitalProduct') {
           await freeDigitalProductEnrollmentMutation.mutateAsync({ digitalProductId: product.id });
           navigate('/student/purchases');
        } else if (product.type === 'bundle') {
          await bundlePurchaseMutation.mutateAsync({ bundleId: product.id });
          toast.success("Successfully enrolled in the bundle!");
          queryClient.invalidateQueries({ queryKey: ['public', 'bundles'] });
          navigate('/student/dashboard');
        } else if (product.type === 'liveTest') {
          // Handled elsewhere if applicable
        }
      } catch (error) {
        console.error(`Failed to enroll in free ${product.type}:`, error);
        toast.error("Failed to enroll. Please try again.");
      }
    } else {
      // If item is already in cart, navigate directly to cart
      if (isInCart) {
        navigate('/cart');
        return;
      }
      
      // Otherwise, add to cart then navigate
      try {
        if (product.type === 'test') {
          await addToCartMutation.mutateAsync({ mockTestId: product.id });
          navigate('/cart');
        } else if (product.type === 'course') {
          await addToCartMutation.mutateAsync({ courseId: product.id });
          navigate('/cart');
        } else if (product.type === 'digitalProduct') {
          await addToCartMutation.mutateAsync({ digitalProductId: product.id });
          navigate('/cart');
        } else if (product.type === 'bundle') {
          toast.loading('Redirecting to payment gateway...');
          window.location.href = getBundleRedirectUrl(product.id);
        } else if (product.type === 'liveTest') {
          // direct purchase not going through cart
        }
      } catch (error) {
        console.error('Failed to add item to cart:', error);
      }
    }
  };
  
  let displayPrice = product.price;
  let formattedOriginalPrice: string | null = null;
  let discountPercentage = 0;

  if (product.type === 'bundle' && product.originalPrice !== undefined && product.originalPrice > product.price && !isFree) {
    displayPrice = product.price;
    formattedOriginalPrice = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(Number(product.originalPrice));
    discountPercentage = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  } else if (product.type === 'test' && product.discountPrice !== null && product.discountPrice > 0 && product.discountPrice < product.price && !isFree) {
    displayPrice = product.discountPrice;
    formattedOriginalPrice = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(Number(product.price));
    discountPercentage = Math.round(((product.price - product.discountPrice) / product.price) * 100);
  }

  const formattedPrice = isFree
    ? "Free"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      }).format(Number(displayPrice));

  // Determine loading state based on product type
  const isEnrollmentPending = product.type === 'test' 
    ? freeTestEnrollmentMutation.isPending 
    : (product.type === 'course' ? freeCourseEnrollmentMutation.isPending 
    : (product.type === 'digitalProduct' ? freeDigitalProductEnrollmentMutation.isPending 
    : (product.type === 'bundle' ? bundlePurchaseMutation.isPending : false)));

  // Only show loading state when actually performing an async action
  // If item is in cart, we're just navigating (no loading needed)
  const isPending = isFree 
    ? isEnrollmentPending 
    : (isInCart ? false : addToCartMutation.isPending);

  return (
    <div className={`${styles.stickyBar} ${isVisible ? styles.visible : ''} ${isEnrolled ? styles.enrolled : ''}`}>
      <div className={styles.content}>
        {isEnrolled ? (
          <Button
            size="md"
            className={styles.enrolledButton}
            onClick={() => {
              if (product.type === 'course') navigate('/student/my-courses');
              else if (product.type === 'digitalProduct') navigate('/student/purchases');
              else navigate('/student/dashboard');
            }}
          >
            {product.type === 'course' ? 'Go to Course' : (product.type === 'digitalProduct' ? 'View Purchases' : 'View My Tests')}
          </Button>
        ) : (
          <>
            <div className={styles.priceSection}>
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
            <Button
              size="md"
              className={styles.buyButton}
              onClick={handleBuyNow}
              disabled={isPending}
            >
              {isFree 
                ? (isPending ? 'Starting...' : 'Start Free')
                : isInCart
                  ? 'Checkout'
                  : (isPending ? 'Processing...' : 'Buy Now')
              }
            </Button>
          </>
        )}
      </div>
    </div>
  );
};