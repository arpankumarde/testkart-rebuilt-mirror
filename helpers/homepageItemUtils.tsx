import type { HomepageMixedItem } from "../endpoints/homepage/data_GET.schema";
import { liveTestPath } from "./liveTestRoutes";
import { coursePriceView, formatOfferInr, type CourseCouponOffer } from "./courseCouponOffer";

export function getProductLink(item: HomepageMixedItem): string {
  switch (item.type) {
    case "test":
      return `/mock-test/${item.slug}`;
    case "course":
      return `/course/${item.slug}`;
    case "bundle":
      return `/bundles/${item.slug}`;
    case "product":
      return `/study-notes/${item.slug}`;
    case "liveTest":
      return liveTestPath(item.slug);
    default:
      return "#";
  }
}

const formatInr = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export function formatItemPrice(price: number, discountPrice?: number | null): string {
  const activePrice = discountPrice != null ? discountPrice : price;
  if (activePrice === 0) return "Free";
  return formatInr(activePrice);
}

export type ItemPriceProps = {
  priceLabel: string;
  originalPriceLabel?: string;
  isFree: boolean;
  /** "25% OFF" when a teacher's automatic course offer sets the price. */
  offerLabel?: string;
};

/**
 * Price props for a product card: the price the student pays, plus the list
 * price to strike through when a discount brings it lower. Pass a course's
 * couponOffer (null when it has none) to price it with the teacher's automatic
 * offer; other item types leave it out.
 */
export function itemPriceProps(
  price: number,
  discountPrice?: number | null,
  couponOffer?: CourseCouponOffer | null
): ItemPriceProps {
  if (couponOffer !== undefined) {
    const view = coursePriceView(price, discountPrice, couponOffer);
    return {
      priceLabel: view.isFree ? "Free" : formatOfferInr(view.finalPrice),
      originalPriceLabel: view.originalPrice !== null ? formatInr(view.originalPrice) : undefined,
      isFree: view.isFree,
      offerLabel: view.offer && view.percentOff > 0 ? `${view.percentOff}% OFF` : undefined,
    };
  }
  const activePrice = discountPrice != null ? discountPrice : price;
  return {
    priceLabel: formatItemPrice(price, discountPrice),
    originalPriceLabel: activePrice < price ? formatInr(price) : undefined,
    isFree: activePrice === 0,
  };
}

/** Bundles store the price paid and the items' combined price as originalPrice. */
export function bundlePriceProps(price: number, originalPrice?: number | null): ItemPriceProps {
  return itemPriceProps(Math.max(price, originalPrice ?? 0), price);
}