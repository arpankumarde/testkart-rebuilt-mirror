import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts, Users, Reviews } from "../../helpers/schema";
import type { CourseCouponOffer } from "../../helpers/courseCouponOffer";

export const schema = z.object({
  slug: z.string(),
});

export type InputType = z.infer<typeof schema>;

// A single file within a (possibly multi-file) study notes product, as
// shown in the public "Files" list on the detail page — deliberately
// excludes fileUrl/fileId, which are never sent to the client directly;
// previewing a specific file goes through the reader (web) or
// preview-page_GET (app) with a fileId instead.
export type StudyNoteFileSummary = {
  id: number;
  title: string;
  pageCount: number | null;
  fileSizeBytes: number | null;
  orderIndex: number;
  /** Free preview pages for this file, capped at its length; null when it has no preview. */
  previewPages: number | null;
};

/** A file's free preview pages as students see them, or null when it has none. */
export const fileSummaryPreviewPages = (
  previewEnabled: boolean,
  previewPages: number | null,
  pageCount: number | null
): number | null => {
  if (!previewEnabled || !previewPages || previewPages < 1) return null;
  return pageCount && pageCount > 0 ? Math.min(previewPages, pageCount) : previewPages;
};

export type ShopProductSeo = {
  indexable: boolean;
  qualityScore: number;
  robots: "index,follow" | "noindex,follow";
};

export type ShopProductDetails = Omit<
  Selectable<DigitalProducts>,
  | "price"
  | "discountPrice"
  | "rating"
  | "totalPurchases"
  | "reviewsCount"
  | "fileSizeBytes"
  | "pdfFileId"
  | "pdfUrl"
  | "updatedAt"
  | "createdAt"
  | "isPublished"
  | "status"
  | "thumbnailFileId"
  | "allowDownload"
  | "expiresAt"
  | "expiredAt"
  | "preExpiryVisibility"
> & {
  /** The teacher lets buyers download this note's PDFs. A flag only, never a link. */
  allowDownload: boolean;
  /** Slug of the linked exam (digitalProducts.examId), for the /exams/{slug} link; null when no exam is linked. */
  examSlug: string | null;
  /** List price. */
  price: number;
  /** What the student pays instead, or null when there is no valid discount. */
  discountPrice: number | null;
  /** The teacher's automatic offer, priced by the server; checkout applies it without a code. */
  couponOffer: CourseCouponOffer | null;
  rating: number | null;
  totalPurchases: number;
  reviewsCount: number;
  fileSizeBytes: number | null;
  fileCount: number;
  files: StudyNoteFileSummary[];
  isPurchased: boolean;
  /** Past its expiry date (helpers/contentExpiry): no longer on sale, though buyers keep access. */
  isExpired: boolean;
  teacherName: string;
  teacherSlug: string;
  teacherAvatar: string | null;
  teacherBio: string | null;
  teacherVerified: boolean;
  teacherAcademyName: string | null;
  disclaimer: string;
  previewUrl: string | null;
  seo: ShopProductSeo;
};

export type PublicReview = Pick<
  Selectable<Reviews>,
  "id" | "reviewerName" | "reviewText" | "createdAt" | "userId" | "teacherReply" | "teacherRepliedAt"
> & {
  rating: number;
};

export type OutputType = {
  product: ShopProductDetails;
  reviews: PublicReview[];
};

export const getShopProductDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/shop/details?slug=${params.slug}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};