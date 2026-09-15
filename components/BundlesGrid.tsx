import React from 'react';
import { Link } from 'react-router-dom';
import { BookCopy, User, Tag, Package } from 'lucide-react';
import type { BundleListItem } from '../endpoints/bundles/list_GET.schema';
import { Skeleton } from './Skeleton';
import { Badge } from './Badge';
import styles from './BundlesGrid.module.css';

interface BundlesGridProps {
  bundles: BundleListItem[];
  isLoading: boolean;
  className?: string;
}

const BundleCard: React.FC<{ bundle: BundleListItem }> = ({ bundle }) => {
  const detailsUrl = `/bundles/${bundle.slug}`;
  const isFree = bundle.price === 0;
  const hasDiscount = bundle.originalPrice > bundle.price;

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

  return (
    <Link to={detailsUrl} className={styles.cardLink}>
      <div className={styles.card}>
        <div className={styles.thumbnailWrapper}>
          {bundle.thumbnailUrl ? (
            <img src={bundle.thumbnailUrl} alt={bundle.title} className={styles.thumbnailImage} />
          ) : (
            <Package size={40} className={styles.bundleIcon} />
          )}
        </div>
        <div className={styles.cardContent}>
          {hasDiscount && bundle.discountPercentage && (
            <div className={styles.badgeWrapper}>
              <Badge variant="success" className={styles.savingsBadge}>
                Save {bundle.discountPercentage.toFixed(0)}%
              </Badge>
            </div>
          )}
          <h3 className={styles.title}>{bundle.title}</h3>
          <p className={styles.creator}>
            <User size={14} />
            <span>By: {bundle.teacherName}</span>
          </p>
          <div className={styles.infoItem}>
            <BookCopy size={14} />
            <span>{bundle.itemCount} Items</span>
          </div>
        </div>
        <div className={styles.cardFooter}>
          {isFree ? (
            <div className={`${styles.price} ${styles.freePrice}`}>Free</div>
          ) : (
            <div className={styles.price}>
              {formattedPrice}
              {hasDiscount && (
                <span className={styles.originalPrice}>{formattedOriginalPrice}</span>
              )}
            </div>
          )}
          <div className={styles.viewButton}>
            <Tag size={16} />
            <span>View Bundle</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const BundleCardSkeleton: React.FC = () => (
  <div className={styles.card}>
    <div className={styles.thumbnailWrapperSkeleton} />
    <div className={styles.cardContent}>
      <Skeleton style={{ height: '1.5rem', width: '80%', marginBottom: 'var(--spacing-2)' }} />
      <Skeleton style={{ height: '1rem', width: '60%' }} />
      <Skeleton style={{ height: '1rem', width: '40%', marginTop: 'var(--spacing-2)' }} />
    </div>
    <div className={styles.cardFooter}>
      <Skeleton style={{ height: '1.75rem', width: '50%' }} />
      <Skeleton style={{ height: '2.25rem', width: '120px' }} />
    </div>
  </div>
);

export const BundlesGrid: React.FC<BundlesGridProps> = ({ bundles, isLoading, className }) => {
  if (isLoading) {
    return (
      <div className={`${styles.grid} ${className || ''}`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <BundleCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (bundles.length === 0) {
    return (
      <div className={styles.emptyState}>
        <BookCopy size={48} className={styles.emptyIcon} />
        <h2>No Bundles Found</h2>
        <p>There are currently no bundles available. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.grid} ${className || ''}`}>
      {bundles.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} />
      ))}
    </div>
  );
};