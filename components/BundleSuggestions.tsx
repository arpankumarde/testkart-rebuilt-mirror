import React from 'react';
import { Link } from 'react-router-dom';
import { Package, BookCopy } from 'lucide-react';
import { useBundlesQuery } from '../helpers/useBundlesQuery';
import { Skeleton } from './Skeleton';
import { Badge } from './Badge';
import { VerifiedBadge } from './VerifiedBadge';
import type { BundleListItem } from '../endpoints/bundles/list_GET.schema';
import styles from './BundleSuggestions.module.css';

interface BundleSuggestionsProps {
  className?: string;
  variant?: 'course' | 'test';
  teacherId?: number;
  title?: string;
  currentBundleId?: number;
}

/* Cycled across the cards for the "Includes" tile, so a row reads playful
   without any one card turning colourful. */
const INCLUDES_TONES = ['toneSage', 'toneLavender', 'toneBlue'] as const;

const BundleSuggestionCard: React.FC<{ bundle: BundleListItem; index: number }> = ({
  bundle,
  index,
}) => {
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

  const toneClass = styles[INCLUDES_TONES[index % INCLUDES_TONES.length]];

  return (
    <Link to={`/bundles/${bundle.slug}`} className={styles.card}>
      <div className={styles.thumbnailWrapper}>
        <div className={styles.thumbnail}>
          {bundle.thumbnailUrl ? (
            <img
              src={bundle.thumbnailUrl}
              alt={bundle.title}
              className={styles.thumbnailImage}
              loading="lazy"
            />
          ) : (
            <Package size={32} className={styles.bundleIcon} aria-hidden="true" />
          )}
        </div>
        {discountPercentage > 0 && (
          <Badge className={styles.discountBadge}>{discountPercentage}% OFF</Badge>
        )}
      </div>

      <div className={styles.content}>
        <h4 className={styles.cardTitle} title={bundle.title}>{bundle.title}</h4>
        <p className={styles.teacherName}>
          <span className={styles.teacherNameText}>By {bundle.teacherName}</span>
          <VerifiedBadge isVerified={bundle.teacherIsVerified} size="xs" className={styles.verifiedIcon} />
        </p>
        <div className={styles.courseCount}>
          <span className={`${styles.countIcon} ${toneClass}`} aria-hidden="true">
            <BookCopy size={13} />
          </span>
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
            <div className={styles.thumbnailWrapper}>
              <Skeleton className={styles.thumbnailSkeleton} />
            </div>
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
      <span className={`${styles.blob} ${styles.blobMint}`} aria-hidden="true" />
      <span className={`${styles.blob} ${styles.blobButter}`} aria-hidden="true" />
      <div className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Package size={18} />
        </span>
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.grid}>
        {suggestedBundles.map((bundle, index) => (
          <BundleSuggestionCard key={bundle.id} bundle={bundle} index={index} />
        ))}
      </div>
    </section>
  );
};