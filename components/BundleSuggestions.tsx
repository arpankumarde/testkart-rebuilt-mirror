import React from 'react';
import { Link } from 'react-router-dom';
import { Package, BookCopy, BadgeCheck } from 'lucide-react';
import { useBundlesQuery } from '../helpers/useBundlesQuery';
import { Skeleton } from './Skeleton';
import { Badge } from './Badge';
import type { BundleListItem } from '../endpoints/bundles/list_GET.schema';
import styles from './BundleSuggestions.module.css';

interface BundleSuggestionsProps {
  className?: string;
  variant?: 'course' | 'test';
  teacherId?: number;
  title?: string;
  currentBundleId?: number;
}

const BundleSuggestionCard: React.FC<{ bundle: BundleListItem }> = ({ bundle }) => {
  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(bundle.price);

  const formattedOriginalPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(bundle.originalPrice);

  const discountPercentage =
    bundle.originalPrice > 0 && bundle.price < bundle.originalPrice
      ? Math.round(((bundle.originalPrice - bundle.price) / bundle.originalPrice) * 100)
      : 0;

  return (
    <Link to={`/bundles/${bundle.slug}`} className={styles.card}>
      <div className={styles.thumbnailWrapper}>
        {bundle.thumbnailUrl ? (
          <img src={bundle.thumbnailUrl} alt={bundle.title} className={styles.thumbnailImage} />
        ) : (
          <Package size={32} className={styles.bundleIcon} />
        )}
        {discountPercentage > 0 && (
          <Badge className={styles.discountBadge}>{discountPercentage}% OFF</Badge>
        )}
      </div>

      <div className={styles.content}>
        <h4 className={styles.cardTitle}>{bundle.title}</h4>
        <p className={styles.teacherName}>
          By {bundle.teacherName}
          {bundle.teacherIsVerified && <BadgeCheck size={14} className={styles.verifiedIcon} />}
        </p>
        <div className={styles.courseCount}>
          <BookCopy size={14} />
          <span>
            Includes {bundle.itemCount} {bundle.itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.priceContainer}>
          <span className={styles.price}>{formattedPrice}</span>
          {bundle.price < bundle.originalPrice && (
            <span className={styles.originalPrice}>{formattedOriginalPrice}</span>
          )}
        </div>
      </div>
    </Link>
  );
};

const BundleSuggestionsSkeleton: React.FC = () => {
  return (
    <div className={styles.container}>
      <Skeleton className={styles.titleSkeleton} />
      <div className={styles.grid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.cardSkeleton}>
            <Skeleton className={styles.thumbnailSkeleton} />
            <div className={styles.contentSkeleton}>
              <Skeleton style={{ height: '1.25rem', width: '80%' }} />
              <Skeleton style={{ height: '1rem', width: '50%', marginTop: 'var(--spacing-2)' }} />
              <Skeleton style={{ height: '1rem', width: '60%', marginTop: 'auto' }} />
            </div>
            <div className={styles.footerSkeleton}>
              <Skeleton style={{ height: '1.5rem', width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BundleSuggestions: React.FC<BundleSuggestionsProps> = ({
  className,
  teacherId,
  title = 'Save with Bundles',
  currentBundleId,
}) => {
  const { data, isFetching, error } = useBundlesQuery({
    teacherId,
    limit: 4, // Fetch 4 in case one is the current bundle
  });

  if (error) {
    console.error('Failed to fetch bundle suggestions:', error);
    return null;
  }

  if (isFetching) {
    return <BundleSuggestionsSkeleton />;
  }

  const suggestedBundles =
    data?.bundles.filter(bundle => bundle.id !== currentBundleId).slice(0, 3) ?? [];

  if (suggestedBundles.length === 0) {
    return null;
  }

  return (
    <section className={`${styles.container} ${className ?? ''}`}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.grid}>
        {suggestedBundles.map(bundle => (
          <BundleSuggestionCard key={bundle.id} bundle={bundle} />
        ))}
      </div>
    </section>
  );
};