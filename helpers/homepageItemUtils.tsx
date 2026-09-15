import type { HomepageMixedItem } from "../endpoints/homepage/data_GET.schema";

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
      return `/mock-test/live/${item.id}`;
    default:
      return "#";
  }
}

export function formatItemPrice(price: number, discountPrice?: number | null): string {
  const activePrice = discountPrice != null ? discountPrice : price;
  if (activePrice === 0) return "Free";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(activePrice);
}