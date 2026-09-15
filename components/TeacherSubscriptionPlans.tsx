import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Zap, AlertCircle } from 'lucide-react';
import { getTeacherSubscriptionPlans, Plan } from '../endpoints/teacher/subscription/plans_GET.schema';
import { Button } from './Button';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import styles from './TeacherSubscriptionPlans.module.css';

const formatPrice = (price: number) => {
  if (price === 0) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(price);
};

const getPlatformFeeDisplay = (price: number, platformFeePercentage: number) => {
  const isFree = price === 0;
  const feePercentage = isFree ? 30 : platformFeePercentage;
  const emoji = feePercentage >= 20 ? '🟠' : '🟢';
  return {
    text: `${emoji} Platform Fee: ${feePercentage}%`,
    variant: feePercentage >= 20 ? 'warning' : 'success' as 'warning' | 'success'
  };
};

const getButtonText = (isFree: boolean) => {
  if (isFree) {
    return 'Start Free';
  }
  return 'Choose Plan';
};

const PlanCard: React.FC<{ plan: Plan; isPopular: boolean }> = ({ plan, isPopular }) => {
  const isFree = plan.price === 0;
  const isYearly = plan.billingCycle === 'yearly';
  const features = Array.isArray(plan.features) ? plan.features : [];
  const platformFeeDisplay = getPlatformFeeDisplay(plan.price, plan.platformFeePercentage);

  return (
    <div className={`${styles.planCard} ${isPopular ? styles.popular : ''}`}>
      {isPopular && (
        <Badge variant="secondary" className={styles.popularBadge}>
          <Zap size={14} /> Most Popular
        </Badge>
      )}
      <div className={styles.cardHeader}>
        <Badge variant={platformFeeDisplay.variant} className={styles.platformFeeBadge}>
          {platformFeeDisplay.text}
        </Badge>
        <h3 className={styles.planName}>{plan.name}</h3>
        <p className={styles.planDescription}>{plan.description}</p>
      </div>
      <div className={styles.planPriceContainer}>
        {isYearly && !isFree && (
          <div className={styles.originalPrice}>
            ₹{Math.round(plan.price * 1.2).toLocaleString('en-IN')} /year
          </div>
        )}
        <div className={styles.priceSection}>
          <span className={styles.price}>{formatPrice(plan.price)}</span>
          {!isFree && <span className={styles.priceDuration}>{isYearly ? '/year' : '/month'}</span>}
        </div>
        {isYearly && !isFree && (
          <div className={styles.effectiveMonthlyPrice}>
            ₹{Math.round(plan.price / 12).toLocaleString('en-IN')}/mo effective
          </div>
        )}
      </div>
      <ul className={styles.featuresList}>
        {features.map((feature, index) => (
          <li key={index} className={styles.featureItem}>
            <span className={styles.featureEmoji}>✅</span>
            <span>{String(feature)}</span>
          </li>
        ))}
      </ul>
      <Button asChild variant={isPopular ? 'primary' : 'outline'} size="lg" className={styles.ctaButton}>
        <Link to={isFree ? '/teacher/signup' : '/teacher/subscription'}>
          {getButtonText(isFree)}
        </Link>
      </Button>
    </div>
  );
};

const SkeletonPlanCard: React.FC<{ isPopular?: boolean }> = ({ isPopular = false }) => (
  <div className={`${styles.planCard} ${isPopular ? styles.popular : ''}`}>
    <div className={styles.cardHeader}>
      <Skeleton className={styles.skeletonBadge} />
      <Skeleton className={styles.skeletonTitle} />
      <Skeleton className={styles.skeletonDescription} />
      <Skeleton className={styles.skeletonDescriptionShort} />
    </div>
    <div className={styles.planPriceContainer}>
      <div className={styles.priceSection}>
        <Skeleton className={styles.skeletonPrice} />
      </div>
    </div>
    <ul className={styles.featuresList}>
      {[...Array(4)].map((_, i) => (
        <li key={i} className={styles.featureItem}>
          <Skeleton className={styles.skeletonIcon} />
          <Skeleton className={styles.skeletonFeatureText} />
        </li>
      ))}
    </ul>
    <Skeleton className={styles.skeletonButton} />
  </div>
);

export const TeacherSubscriptionPlans: React.FC<{ className?: string }> = ({ className }) => {
  const { data: plans, isFetching, error } = useQuery({
    queryKey: ['teacherSubscriptionPlans'],
    queryFn: getTeacherSubscriptionPlans,
  });

  if (isFetching) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.plansGrid}>
          <SkeletonPlanCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.container} ${styles.errorContainer} ${className || ''}`}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h3 className={styles.errorTitle}>Could not load plans</h3>
        <p className={styles.errorMessage}>
          There was an issue fetching the subscription plans. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const filteredPlans = plans
    ? plans.filter((plan) => plan.name.toLowerCase().includes('business') && plan.billingCycle === 'yearly')
    : [];

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.plansGrid}>
        {filteredPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isPopular={false}
          />
        ))}
      </div>
    </div>
  );
};