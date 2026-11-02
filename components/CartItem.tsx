import React from "react";
import { Link } from "react-router-dom";
import { Trash2, Tag, FileText, CalendarX } from "lucide-react";
import { Button } from "./Button";
import { CartItem as CartItemType } from "../endpoints/cart/items_GET.schema";
import { Skeleton } from "./Skeleton";
import { Placeholder } from "../helpers/placeholderImages";
import { formatOfferInr } from "../helpers/courseCouponOffer";
import type { CartItemPricing } from "../helpers/cartItemPricing";
import styles from "./CartItem.module.css";

interface CartItemProps {
  item: CartItemType;
  /** The item's prices from the cart quote; see helpers/cartItemPricing. */
  pricing: CartItemPricing;
  onRemove: (cartItemId: number) => void;
  isRemoving: boolean;
}

const TYPE_LABEL: Record<CartItemType["type"], string> = {
  course: "Course",
  test: "Mock Test",
  digitalProduct: "Notes",
};

export const CartItem: React.FC<CartItemProps> = ({ item, pricing, onRemove, isRemoving }) => {
  let itemLink: string;
  let teacherName: string | null;
  let thumbnail = item.thumbnailUrl;

  if (item.type === "test") {
    teacherName = item.creatorName;
    // The slug is "examSlug.testSlug" and the page lives at /examSlug/testSlug.
    itemLink = item.slug ? `/${item.slug.replace(".", "/")}` : "/mock-test";
    if (!thumbnail) thumbnail = Placeholder.TEST;
  } else if (item.type === "course") {
    teacherName = item.teacherName;
    itemLink = item.slug ? `/course/${item.slug}` : "/course";
    if (item.thumbnailImageUrl) thumbnail = item.thumbnailImageUrl;
    if (!thumbnail) thumbnail = Placeholder.COURSE;
  } else {
    teacherName = item.teacherName;
    itemLink = item.slug ? `/study-notes/${item.slug}` : "/study-notes";
    // Study notes have no thumbnail anywhere on the site.
    thumbnail = null;
  }

  const hasSaving = pricing.savings > 0;

  return (
    <article className={styles.card}>
      <Link to={itemLink} className={styles.imageLink} tabIndex={-1} aria-hidden="true">
        {thumbnail ? (
          <img src={thumbnail} alt="" className={styles.image} loading="lazy" />
        ) : (
          <div className={styles.iconPlaceholder}>
            <FileText size={28} />
          </div>
        )}
      </Link>

      <div className={styles.body}>
        <div className={styles.details}>
          <span className={`${styles.typeBadge} ${styles[`type_${item.type}`]}`}>{TYPE_LABEL[item.type]}</span>
          <Link to={itemLink} className={styles.titleLink}>
            <h3 className={styles.title}>{item.title}</h3>
          </Link>
          {teacherName ? <p className={styles.creator}>by {teacherName}</p> : null}
          {item.expired ? (
            <p className={styles.expired}>
              <CalendarX size={13} aria-hidden="true" />
              <span>Expired. No longer available for purchase. Remove it to check out.</span>
            </p>
          ) : null}
          {pricing.teacherDiscount > 0 ? (
            <p className={styles.offer}>
              <Tag size={13} aria-hidden="true" />
              <span>
                {pricing.teacherCode ? <strong>{pricing.teacherCode}</strong> : "Teacher offer"} applied
                {" · "}
                {formatOfferInr(pricing.teacherDiscount)} off
              </span>
            </p>
          ) : null}
        </div>

        <div className={styles.priceBlock}>
          <div className={styles.priceRow}>
            <span className={styles.finalPrice}>{formatOfferInr(pricing.finalPrice)}</span>
            {hasSaving ? <span className={styles.percentBadge}>{pricing.percentOff}% OFF</span> : null}
          </div>
          {hasSaving ? (
            <>
              <span className={styles.originalPrice}>
                <span className={styles.srOnly}>Original price </span>
                {formatOfferInr(pricing.mrp)}
              </span>
              <span className={styles.savings}>You save {formatOfferInr(pricing.savings)}</span>
            </>
          ) : null}
        </div>
      </div>

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
    </article>
  );
};

export const CartItemSkeleton: React.FC = () => (
  <div className={styles.card}>
    <Skeleton className={styles.imageSkeleton} />
    <div className={styles.body}>
      <div className={styles.details}>
        <Skeleton style={{ width: "4rem", height: "1.125rem", marginBottom: "0.5rem" }} />
        <Skeleton style={{ width: "70%", height: "1.25rem", marginBottom: "0.5rem" }} />
        <Skeleton style={{ width: "40%", height: "1rem" }} />
      </div>
      <Skeleton style={{ width: "6rem", height: "1.5rem" }} />
    </div>
  </div>
);
