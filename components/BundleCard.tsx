import React from 'react';
import { Edit, Trash2, MoreVertical, Eye, EyeOff, Package, ExternalLink, Share2 } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { ShareAssetDialog } from './ShareAssetDialog';
import { buildPublicAssetUrl, TEACHER_CONSOLE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
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

  const bundleUrl = buildPublicAssetUrl('bundle', bundle.slug);

  const handleOpenLink = () => {
    window.open(bundleUrl, '_blank');
  };

  const statusText = bundle.isPublished ? 'Published' : 'Draft';

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

  const publishToggleLabel = bundle.isPublished ? 'Unpublish' : 'Publish bundle';
  const publishToggleIcon = bundle.isPublished ? <EyeOff size={16} /> : <Eye size={16} />;

  return (
    <div className={styles.card}>
      <div className={styles.thumbnailWrapper}>
        {bundle.thumbnailUrl ? (
          <img src={bundle.thumbnailUrl} alt={bundle.title} className={styles.thumbnailImage} />
        ) : (
          <Package size={32} className={styles.bundleIcon} />
        )}
        {/* Overlaid on the thumbnail, as on every other teacher card. */}
        <span
          className={`${styles.status} ${bundle.isPublished ? styles.published : styles.draft}`}
        >
          {statusText}
        </span>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.badgeGroup}>
            {discountPercentage > 0 && (
              <Badge className={styles.discountBadge}>{discountPercentage}% OFF</Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className={styles.menuButton}>
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit size={16} />
                <span>Edit Bundle</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPublishToggle}>
                {publishToggleIcon}
                <span>{publishToggleLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className={styles.deleteItem}>
                <Trash2 size={16} />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className={styles.title}>{bundle.title}</h3>

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
        <div className={styles.actions}>
          {bundle.isPublished && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShareOpen(true)}
                title="Share"
                aria-label={`Share ${bundle.title}`}
                className={styles.copyButton}
              >
                <Share2 size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleOpenLink}
                title="Open in New Tab"
                aria-label="Open in New Tab"
                className={styles.copyButton}
              >
                <ExternalLink size={16} />
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={onEdit}>
            Manage
          </Button>
        </div>
      </div>

      {bundle.isPublished && (
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
    </div>
  );
};