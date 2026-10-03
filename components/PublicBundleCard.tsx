import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookCopy, Tag, Package } from 'lucide-react';
import type { BundleListItem } from '../endpoints/bundles/list_GET.schema';
import { Avatar, AvatarImage, AvatarFallback } from './Avatar';
import { VerifiedBadge } from './VerifiedBadge';
import { Skeleton } from './Skeleton';
import { Badge } from './Badge';
import styles from './PublicBundleCard.module.css';

const formatInr = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(value);

/**
 * The one public bundle card, shared by the /bundles page, the exam bundles
 * listing, related bundles and the exam overview's Bundles block, so all of
 * them look the same. Rows keep a fixed height (badge row, two-line title),
 * so cards in a grid line up whatever the title length or discount.
 */
export const PublicBundleCard: React.FC<{ bundle: BundleListItem }> = ({ bundle }) => {
  const navigate = useNavigate();
  const isFree = bundle.price === 0;
  const hasDiscount = bundle.originalPrice > bundle.price;
  const teacherProfileUrl = bundle.teacherSlug ? `/expert/${bundle.teacherSlug}` : null;

  // The whole card is a link to the bundle; the teacher row opens their
  // profile instead (a nested <a> isn't allowed, so it is a link-role span).
  const openTeacher = (e: React.SyntheticEvent) => {
    if (!teacherProfileUrl) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(teacherProfileUrl);
  };

  return (
    <Link to={`/bundles/${bundle.slug}`} className={styles.card}>
      <div className={styles.thumbnailWrapper}>
        {bundle.thumbnailUrl ? (
          <img src={bundle.thumbnailUrl} alt={bundle.title} className={styles.thumbnailImage} loading="lazy" />
        ) : (
          <Package size={40} className={styles.bundleIcon} />
        )}
      </div>
      <div className={styles.cardContent}>
        <div className={styles.badgeRow}>
          {hasDiscount && bundle.discountPercentage ? (
            <Badge variant="success" className={styles.savingsBadge}>
              Save {bundle.discountPercentage.toFixed(0)}%
            </Badge>
          ) : null}
        </div>
        <h3 className={styles.title}>{bundle.title}</h3>
        <span
          className={`${styles.creator} ${teacherProfileUrl ? styles.creatorLink : ''}`}
          {...(teacherProfileUrl
            ? {
                role: 'link',
                tabIndex: 0,
                onClick: openTeacher,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') openTeacher(e);
                },
              }
            : {})}
        >
          <Avatar className={styles.avatar}>
            {bundle.teacherAvatarUrl && <AvatarImage src={bundle.teacherAvatarUrl} alt="" />}
            <AvatarFallback className={styles.avatarFallback}>
              {(bundle.teacherName || '?').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className={styles.creatorName}>{bundle.teacherName}</span>
          <VerifiedBadge isVerified={bundle.teacherIsVerified} size="sm" />
        </span>
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
            {formatInr(bundle.price)}
            {hasDiscount && <span className={styles.originalPrice}>{formatInr(bundle.originalPrice)}</span>}
          </div>
        )}
        <div className={styles.viewButton}>
          <Tag size={16} />
          <span>View Bundle</span>
        </div>
      </div>
    </Link>
  );
};

/** Mirrors PublicBundleCard row for row, so nothing shifts when data lands. */
export const PublicBundleCardSkeleton: React.FC = () => (
  <div className={styles.card} aria-hidden="true">
    <div className={styles.thumbnailWrapperSkeleton} />
    <div className={styles.cardContent}>
      <div className={styles.badgeRow}>
        <Skeleton style={{ height: '1.5rem', width: '5.5rem', borderRadius: 'var(--radius-full)' }} />
      </div>
      <div className={styles.titleSkeleton}>
        <Skeleton style={{ height: '1.1rem', width: '92%' }} />
        <Skeleton style={{ height: '1.1rem', width: '64%' }} />
      </div>
      <div className={styles.creator}>
        <Skeleton style={{ height: '1.5rem', width: '1.5rem', borderRadius: 'var(--radius-full)' }} />
        <Skeleton style={{ height: '0.875rem', width: '7rem' }} />
      </div>
      <div className={styles.infoItem}>
        <Skeleton style={{ height: '1.0625rem', width: '4.5rem' }} />
      </div>
    </div>
    <div className={styles.cardFooter}>
      <Skeleton className={styles.priceSkeleton} style={{ width: '6.5rem' }} />
      <Skeleton style={{ height: '1.125rem', width: '6rem' }} />
    </div>
  </div>
);
