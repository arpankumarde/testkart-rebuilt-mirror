import React from 'react';
import { BookCopy } from 'lucide-react';
import type { BundleListItem } from '../endpoints/bundles/list_GET.schema';
import { PublicBundleCard, PublicBundleCardSkeleton } from './PublicBundleCard';
import styles from './BundlesGrid.module.css';

interface BundlesGridProps {
  bundles: BundleListItem[];
  isLoading: boolean;
  className?: string;
}

export const BundlesGrid: React.FC<BundlesGridProps> = ({ bundles, isLoading, className }) => {
  if (isLoading) {
    return (
      <div className={`${styles.grid} ${className || ''}`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <PublicBundleCardSkeleton key={index} />
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
        <PublicBundleCard key={bundle.id} bundle={bundle} />
      ))}
    </div>
  );
};
