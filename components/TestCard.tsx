import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Clock, ShoppingCart, TrendingUp, IndianRupee, Star, Users, Plus, FileText, Eye } from "lucide-react";
import type { TestListItem } from "../endpoints/tests/list_GET.schema";
import { useAddToCartMutation } from "../helpers/useCartQuery";
import { useAuth } from "../helpers/useAuth";
import { VerifiedBadge } from "./VerifiedBadge";
import { Placeholder } from "../helpers/placeholderImages";
import { VideoPreview } from "./VideoPreview";
import styles from "./TestCard.module.css";

interface TestCardProps {
  test: TestListItem;
  className?: string;
}

export const TestCard: React.FC<TestCardProps> = ({ test, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const addToCartMutation = useAddToCartMutation();

  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't add to cart if already enrolled or if user is a teacher
    if (isEnrolled || isTeacher) {
      return;
    }

    // Check if user is authenticated
    if (authState.type !== "authenticated") {
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Call the mutation
    addToCartMutation.mutate({ mockTestId: test.id });
  };

  const detailsUrl = `/mock-test/${test.slug}`;

  const isFree = Number(test.price) === 0;
  const isEnrolled = test.isEnrolled;
  
  // Check if there's a valid discount price
  const hasDiscount = test.discountPrice !== null && 
                      test.discountPrice > 0 && 
                      test.discountPrice < test.price;
  
  const displayPrice = hasDiscount ? test.discountPrice : test.price;
  
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
      }).format(Number(test.price))
    : null;

  const discountPercentage = hasDiscount
    ? Math.round(((test.price - test.discountPrice!) / test.price) * 100)
    : 0;

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("en-IN").format(num);
  };

  const creatorDisplayName = test.teacherName || test.creatorName;

  const hasRating = test.rating !== null && test.rating !== undefined;
  const ratingValue = hasRating ? Number(test.rating).toFixed(1) : null;

  const hasStudentsEnrolled = test.studentsEnrolled > 0;

  return (
            <Link to={detailsUrl} className={`${styles.cardLink} ${className || ""}`}>
      <div className={styles.card}>
        {/* Top Badges */}
        {(test.examName || test.language) && (
          <div className={styles.badgeContainer}>
            {test.examName && (
              <Badge variant="default">{test.examName}</Badge>
            )}
            {test.language && (
              <Badge variant="secondary">{test.language}</Badge>
            )}
          </div>
        )}

        {/* Thumbnail Image */}
        <div className={styles.thumbnail}>
          {test.introVideoUrl ? (
            <VideoPreview
              videoUrl={test.introVideoUrl}
              thumbnailUrl={test.thumbnailUrl}
              title={test.title}
            />
          ) : test.thumbnailUrl ? (
            <img
              src={test.thumbnailUrl || undefined}
              alt={test.title}
              className={styles.thumbnailImage}
              width={600}
              height={338}
            />
          ) : (
            <img
              src={Placeholder.TEST}
              alt={test.title}
              className={styles.thumbnailImage}
              width={600}
              height={338}
            />
          )}
          
          {/* Quick Add to Cart Button - Hidden for teachers */}
          {!isTeacher && (
            <Button
              asChild
              size="icon-md"
              variant="primary"
              className={`${styles.quickAddButton} ${isEnrolled ? styles.quickAddButtonDisabled : ''}`}
              disabled={addToCartMutation.isPending || isEnrolled}
            >
              <div 
                onClick={handleAddToCart}
                role="button"
                tabIndex={0}
                aria-label={isEnrolled ? "Already enrolled" : "Add to cart"}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAddToCart(e as any);
                  }
                }}
              >
                {addToCartMutation.isPending ? (
                  <div className={styles.spinner} />
                ) : (
                  <Plus size={20} />
                )}
              </div>
            </Button>
          )}
        </div>

        {/* Card Content */}
        <div className={styles.cardContent}>
          {/* Title */}
          <h3 className={styles.title}>{test.title}</h3>

          {/* Creator */}
          <p className={styles.creator}>By: {creatorDisplayName} <VerifiedBadge isVerified={test.teacherIsVerified} size="sm" /></p>

          {/* Rating and Reviews */}
          {hasRating && (
            <div className={styles.ratingContainer}>
              <Star size={16} className={styles.starIcon} fill="currentColor" />
              <span className={styles.ratingValue}>{ratingValue}</span>
              <span className={styles.reviewsCount}>
                ({formatNumber(test.reviewsCount)} {test.reviewsCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          )}

          {/* Info Grid */}
          <div className={styles.infoGrid}>
            {/* Total Questions */}
            <div className={styles.infoRow}>
              <div className={styles.infoIcon}>
                <FileText size={16} />
              </div>
              <div className={styles.infoText}>
                <span className={styles.infoLabel}>Questions:</span>
                <span className={styles.infoValue}>{formatNumber(test.actualQuestionCount)}</span>
              </div>
            </div>

            {/* Total Time */}
            {test.durationMinutes !== undefined && test.durationMinutes !== null && (
              <div className={styles.infoRow}>
                <div className={styles.infoIcon}>
                  <Clock size={16} />
                </div>
                <div className={styles.infoText}>
                  <span className={styles.infoLabel}>Total Time:</span>
                  <span className={styles.infoValue}>
                    {test.durationMinutes > 0 ? `${test.durationMinutes} Minutes` : "No Time Limit"}
                  </span>
                </div>
              </div>
            )}

            {/* Views */}
            <div className={styles.infoRow}>
              <div className={styles.infoIcon}>
                <Eye size={16} />
              </div>
              <div className={styles.infoText}>
                <span className={styles.infoLabel}>Views:</span>
                <span className={styles.infoValue}>{formatNumber(test.views ?? 0)}</span>
              </div>
            </div>

            {/* Test Items */}
            <div className={styles.infoRow}>
              <div className={styles.infoIcon}>
                                <TrendingUp size={16} />
              </div>
              <div className={styles.infoText}>
                <span className={styles.infoLabel}>Test Items:</span>
                <span className={styles.infoValue}>
                                    {test.totalTests}
                  {test.freeTestsCount > 0 && (
                    <span className={styles.freeTests}> ({test.freeTestsCount} Free {test.freeTestsCount === 1 ? 'Test' : 'Tests'})</span>
                  )}
                </span>
              </div>
            </div>

                        {/* Students Enrolled - hidden for now */}
            {false && hasStudentsEnrolled && (
              <div className={styles.infoRow}>
                <div className={styles.infoIcon}>
                  <Users size={16} />
                </div>
                <div className={styles.infoText}>
                  <span className={styles.infoLabel}>Students Enrolled:</span>
                  <span className={styles.infoValue}>{formatNumber(test.studentsEnrolled)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.cardFooter}>
          {!isTeacher && (
            <div className={`${styles.buyButton} ${isFree ? styles.freeButton : ''} ${isEnrolled ? styles.enrolledButton : ''}`}>
              <ShoppingCart size={18} />
              {isEnrolled ? "Already Enrolled" : isFree ? "Start Free" : "Buy Now"}
            </div>
          )}
          {isTeacher ? (
            <div className={styles.teacherText}>
              For Students Only
            </div>
          ) : (
            <div className={styles.priceContainer}>
            {hasDiscount && (
              <div className={styles.originalPriceRow}>
                <IndianRupee size={16} />
                <span className={styles.originalPrice}>{formattedOriginalPrice!.replace("₹", "")}</span>
                <span className={styles.discountBadge}>{discountPercentage}% OFF</span>
              </div>
            )}
            <div className={`${styles.price} ${isFree ? styles.freePrice : ''}`}>
              {!isFree && <IndianRupee size={20} />}
              <span>{isFree ? formattedPrice : formattedPrice.replace("₹", "")}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};