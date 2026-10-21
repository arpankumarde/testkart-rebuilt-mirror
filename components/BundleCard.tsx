import React from 'react';
import { Edit, EyeOff, Trash2, MoreVertical, Package, Share2, Undo2, Wrench } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { ShareAssetDialog } from './ShareAssetDialog';
import { TeacherCardInsights } from './TeacherCardInsights';
import { TeacherRejectionNote } from './TeacherRejectionNote';
import { UnlistedBadge } from './UnlistedBadge';
import { WithdrawReviewDialog, WITHDRAW_REVIEW_LABEL } from './WithdrawReviewButton';
import { TEACHER_CONSOLE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { computeBundlePricing } from '../helpers/bundlePricing';
import type { BundleListItem } from '../endpoints/teacher/bundles/list_GET.schema';
import styles from './BundleCard.module.css';

interface BundleCardProps {
  bundle: BundleListItem;
  onEdit: () => void;
  onDelete: () => void;
  onPublishToggle: () => void;
}

export const BundleCard: React.FC<BundleCardProps> = ({
  bundle,
  onEdit,
  onDelete,
  onPublishToggle,
}) => {
  const [isShareOpen, setShareOpen] = React.useState(false);
  const [isWithdrawOpen, setWithdrawOpen] = React.useState(false);

  const isPublished = bundle.isPublished;
  const isInReview = !isPublished && bundle.inReview;
  const rejection = !isPublished && !isInReview ? bundle.rejection : null;
  const statusText = isPublished ? 'Published' : isInReview ? 'In review' : rejection ? 'Rejected' : 'Draft';
  const statusClass = isPublished
    ? styles.published
    : isInReview
      ? styles.inReview
      : rejection
        ? styles.rejected
        : styles.draft;

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(bundle.price);

  const formattedOriginalPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(bundle.currentOriginalPrice);

  // The strikethrough and discount come from the items' prices today. When
  // those moved since the last save, the public page still shows the stored
  // figure, so the card says so.
  const discountPercentage = Math.round(
    computeBundlePricing([bundle.currentOriginalPrice], bundle.price).discountPercentage
  );
  const isPriceStale = Math.abs(bundle.currentOriginalPrice - bundle.originalPrice) >= 0.01;

  // The only entry in the overflow menu. Non-modal so the dialogs it opens do
  // not inherit its pointer lock.
  const deleteMenu = (size: 'icon' | 'icon-sm') => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className={styles.menuButton}
          aria-label={`More actions for ${bundle.title}`}
        >
          <MoreVertical size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDelete} className={styles.deleteItem}>
          <Trash2 size={16} />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className={styles.card}>
      <div className={styles.thumbnailWrapper}>
        {bundle.thumbnailUrl ? (
          <img src={bundle.thumbnailUrl} alt={bundle.title} className={styles.thumbnailImage} />
        ) : (
          <Package size={32} className={styles.bundleIcon} />
        )}
        {/* Overlaid on the thumbnail, as on every other teacher card. */}
        <span className={`${styles.status} ${statusClass}`}>{statusText}</span>
      </div>

      <div className={styles.content}>
        {/* A published card keeps its menu in the price row, as the Test Series card does. */}
        {(discountPercentage > 0 || !isPublished) && (
          <div className={styles.header}>
            <div className={styles.badgeGroup}>
              {discountPercentage > 0 && (
                <Badge className={styles.discountBadge}>{discountPercentage}% OFF</Badge>
              )}
            </div>
            {!isPublished && deleteMenu('icon-sm')}
          </div>
        )}

        <h3 className={styles.title}>{bundle.title}</h3>
        {bundle.visibility === 'unlisted' && <UnlistedBadge />}

        {rejection && <TeacherRejectionNote rejection={rejection} />}

        {isPriceStale && (
          <p className={styles.staleNote}>
            Item prices changed since this bundle was saved. Open it and save to refresh its price.
          </p>
        )}

        <div className={styles.courseCount}>
          {bundle.itemCount} {bundle.itemCount === 1 ? 'item' : 'items'}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.priceContainer}>
          <span className={styles.price}>{formattedPrice}</span>
          {discountPercentage > 0 && (
            <span className={styles.originalPrice}>{formattedOriginalPrice}</span>
          )}
        </div>
        {isPublished ? (
          <div className={styles.actions}>
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit size={14} />
              Edit
            </Button>
            {deleteMenu('icon')}
          </div>
        ) : (
          /* Publish stays here because the editor has no publish control of its own. */
          <div className={styles.actions}>
            {isInReview ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setWithdrawOpen(true)}
                title={WITHDRAW_REVIEW_LABEL}
                aria-label={WITHDRAW_REVIEW_LABEL}
                className={styles.copyButton}
              >
                <Undo2 size={16} />
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onPublishToggle}>
                Publish
              </Button>
            )}
            {rejection ? (
              <Button size="sm" variant="primary" onClick={onEdit}>
                <Wrench size={14} />
                Fix it
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onEdit}>
                Edit
              </Button>
            )}
          </div>
        )}
      </div>

      {isPublished && (
        <TeacherCardInsights
          itemTitle={bundle.title}
          ariaLabel={`Actions for ${bundle.title}`}
          items={[
            { label: 'Share', icon: Share2, onClick: () => setShareOpen(true) },
            { label: 'Unpublish', icon: EyeOff, onClick: onPublishToggle },
          ]}
        />
      )}

      {isPublished && (
        <ShareAssetDialog
          open={isShareOpen}
          onOpenChange={setShareOpen}
          kind="bundle"
          handle={bundle.slug}
          campaign={TEACHER_CONSOLE_SHARE_CAMPAIGN}
          sharer="owner"
          title={bundle.title}
        />
      )}
      {isInReview && (
        <WithdrawReviewDialog
          open={isWithdrawOpen}
          onOpenChange={setWithdrawOpen}
          contentType="course_bundle"
          contentId={bundle.id}
          title={bundle.title}
        />
      )}
    </div>
  );
};
