import React from "react";
import { Link } from "react-router-dom";
import { Trash2, Tag, IndianRupee, FileText } from "lucide-react";
import { Button } from "./Button";
import { CartItem as CartItemType } from "../endpoints/cart/items_GET.schema";
import { Skeleton } from "./Skeleton";
import { Placeholder } from "../helpers/placeholderImages";
import styles from "./CartItem.module.css";

interface CartItemProps {
  item: CartItemType;
  onRemove: (cartItemId: number) => void;
  isRemoving: boolean;
  isEligibleForPromo?: boolean;
}

export const CartItem: React.FC<CartItemProps> = ({
  item,
  onRemove,
  isRemoving,
  isEligibleForPromo = false,
}) => {
  let itemLink: string;
  let creatorName: string;
  let typeLabel: string | null = null;
  let thumbnail = item.thumbnailUrl;

        if (item.type === 'test') {
    creatorName = item.creatorName || "Testkart Creator";
    // Tests use /{examSlug}/{testSlug} format, but the slug returned is already "examSlug.testSlug" 
    // which maps to /{slug with . replaced by /}
    itemLink = item.slug ? `/${item.slug.replace('.', '/')}` : `/mock-test`;
    if (!thumbnail) thumbnail = Placeholder.TEST;
  } else if (item.type === 'course') {
    creatorName = item.teacherName || "Testkart Creator";
    // Courses use /course/{slug} format
    itemLink = item.slug ? `/course/${item.slug}` : `/course`;
    if (item.thumbnailImageUrl) thumbnail = item.thumbnailImageUrl;
    if (!thumbnail) thumbnail = Placeholder.COURSE;
  } else {
    // Digital Product - uses /shop/{slug} format
    creatorName = "Testkart Creator";
    typeLabel = "Study Notes";
    itemLink = item.slug ? `/study-notes/${item.slug}` : `/study-notes`;
    thumbnail = null; // Do not use image for digital products
  }

  return (
    <div className={styles.card}>
      <Link to={itemLink} className={styles.imageLink}>
        {thumbnail ? (
          <img src={thumbnail} alt={item.title} className={styles.image} />
        ) : (
          <div className={styles.iconPlaceholder}>
            <FileText size={32} className={styles.placeholderIcon} />
          </div>
        )}
      </Link>
      
      <div className={styles.content}>
        <div className={styles.details}>
          <div className={styles.header}>
            <Link to={itemLink} className={styles.titleLink}>
              <h3 className={styles.title}>{item.title}</h3>
            </Link>
            
            <Button
              variant="ghost"
              size="icon-sm"
              className={styles.removeButton}
              onClick={() => onRemove(item.cartItemId)}
              disabled={isRemoving}
              aria-label={`Remove ${item.title} from cart`}
            >
              <Trash2 size={16} />
            </Button>
          </div>

          <p className={styles.creator}>by {creatorName}</p>

          <div className={styles.badges}>
            {typeLabel && (
              <span className={styles.typeBadge}>{typeLabel}</span>
            )}
            {isEligibleForPromo && (
              <span className={styles.promoBadge}>
                <Tag size={12} />
                <span>Offer Applied</span>
              </span>
            )}
          </div>
        </div>

        <div className={styles.priceContainer}>
          {item.discountPrice && item.discountPrice < item.price ? (
            <>
              <span className={styles.originalPrice}>
                <IndianRupee size={12} />
                {item.price.toFixed(2)}
              </span>
              <span className={styles.finalPrice}>
                <IndianRupee size={16} />
                {(item.discountPrice).toFixed(2)}
              </span>
            </>
          ) : (
            <span className={styles.finalPrice}>
              <IndianRupee size={16} />
              {item.price.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const CartItemSkeleton: React.FC = () => (
  <div className={styles.card}>
    <Skeleton className={styles.imageSkeleton} />
    <div className={styles.content}>
      <div className={styles.details}>
        <Skeleton style={{ width: '70%', height: '1.25rem', marginBottom: '0.5rem' }} />
        <Skeleton style={{ width: '40%', height: '1rem', marginBottom: '0.5rem' }} />
      </div>
      <Skeleton style={{ width: '80px', height: '1.5rem', alignSelf: 'flex-start' }} />
    </div>
  </div>
);