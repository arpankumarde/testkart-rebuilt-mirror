import React from 'react';
import type { BundleListItem } from '../endpoints/bundles/list_GET.schema';
import { TeacherProductCard } from './HomepageContentSection';
import { Skeleton } from './Skeleton';
import { Placeholder } from '../helpers/placeholderImages';
import { bundlePriceProps } from '../helpers/homepageItemUtils';
import styles from './PublicBundleCard.module.css';

/**
 * The public bundle card, shared by the /bundles page, the exam bundles
 * listing, related bundles and the exam overview's Bundles block. It is the
 * same TeacherProductCard the mock test, course and study note cards use
 * (and the expert profile already uses for bundles), so every asset type
 * reads as one family: teacher header, title, 16:9 image, stats + price.
 */
export const PublicBundleCard: React.FC<{ bundle: BundleListItem }> = ({ bundle }) => {
  const hasDiscount = bundle.originalPrice > bundle.price && !!bundle.discountPercentage;
  const stats = (
    <>
      {bundle.itemCount} {bundle.itemCount === 1 ? 'item' : 'items'}
      {hasDiscount && (
        <span className={styles.saveChip}>Save {bundle.discountPercentage!.toFixed(0)}%</span>
      )}
    </>
  );

  return (
    <TeacherProductCard
      link={`/bundles/${bundle.slug}`}
      teacherName={bundle.teacherName ?? ''}
      teacherAvatarUrl={bundle.teacherAvatarUrl}
      teacherTagline={null}
      teacherYearsOfExperience={null}
      teacherSlug={bundle.teacherSlug ?? null}
      teacherIsVerified={bundle.teacherIsVerified}
      productTitle={bundle.title}
      stats={stats}
      {...bundlePriceProps(bundle.price, bundle.originalPrice)}
      thumbnailUrl={bundle.thumbnailUrl}
      placeholderUrl={Placeholder.COURSE}
    />
  );
};

/** Same shape as the TeacherProductCard skeletons used across the site. */
export const PublicBundleCardSkeleton: React.FC = () => (
  <div className={styles.skeletonCard} aria-hidden="true">
    <div className={styles.skeletonHeader}>
      <Skeleton className={styles.skeletonAvatar} />
      <Skeleton style={{ height: 14, width: 110 }} />
    </div>
    <Skeleton style={{ height: 18, width: '90%', marginBottom: 'var(--spacing-3)' }} />
    <Skeleton className={styles.skeletonThumbnail} />
    <div className={styles.skeletonStats}>
      <Skeleton style={{ height: 14, width: 90 }} />
      <Skeleton style={{ height: 14, width: 56 }} />
    </div>
  </div>
);
