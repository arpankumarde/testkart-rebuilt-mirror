import { ProductEmbedType, ProductSearchItem } from "../endpoints/admin/blog/product-search_GET.schema";

// Shared shape for a single embedded product, baked into the blog post's
// saved HTML at insert time (see RichTextEditor's ProductEmbed node). Keeping
// this denormalized snapshot — rather than a live lookup at render time —
// mirrors how CustomImage already stores a real `src`: the public blog page
// just sanitizes and injects the HTML, no extra fetch/hydration needed.
export interface EmbeddedProductItem {
  type: ProductEmbedType;
  id: number;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  originalPrice: number | null;
  teacherName: string | null;
  isFree: boolean;
  href: string;
  badge: string;
}

export const PRODUCT_EMBED_BADGES: Record<ProductEmbedType, string> = {
  mock_test: "Mock Test",
  digital_product: "Study Notes",
  course: "Course",
  bundle: "Bundle",
};

export const PRODUCT_EMBED_TYPE_LABELS: Record<ProductEmbedType, string> = {
  mock_test: "Mock Tests",
  digital_product: "Study Notes",
  course: "Courses",
  bundle: "Bundles",
};

export function buildProductEmbedHref(type: ProductEmbedType, slug: string): string {
  switch (type) {
    case "mock_test":
      return `/mock-test/${slug}`;
    case "digital_product":
      return `/study-notes/${slug}`;
    case "course":
      return `/course/${slug}`;
    case "bundle":
      return `/bundles/${slug}`;
    default:
      return "/";
  }
}

export function toEmbeddedProductItem(item: ProductSearchItem): EmbeddedProductItem {
  return {
    type: item.type,
    id: item.id,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    price: item.price,
    originalPrice: item.originalPrice,
    teacherName: item.teacherName,
    isFree: item.isFree,
    href: buildProductEmbedHref(item.type, item.slug),
    badge: PRODUCT_EMBED_BADGES[item.type],
  };
}

export function formatEmbedPrice(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}
