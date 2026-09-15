import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts, Users, Reviews } from "../../helpers/schema";

export const schema = z.object({
  slug: z.string(),
});

export type InputType = z.infer<typeof schema>;

// A single file within a (possibly multi-file) study notes product, as
// shown in the public "Files" list on the detail page — deliberately
// excludes fileUrl/fileId, which are never sent to the client directly;
// previewing a specific file goes through preview-page_GET with a fileId
// instead.
export type StudyNoteFileSummary = {
  id: number;
  title: string;
  pageCount: number | null;
  fileSizeBytes: number | null;
  orderIndex: number;
};

export type ShopProductSeo = {
  indexable: boolean;
  qualityScore: number;
  robots: "index,follow" | "noindex,follow";
};

export type ShopProductDetails = Omit<
  Selectable<DigitalProducts>,
  | "price"
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
> & {
  price: number;
  rating: number | null;
  totalPurchases: number;
  reviewsCount: number;
  fileSizeBytes: number | null;
  fileCount: number;
  files: StudyNoteFileSummary[];
  isPurchased: boolean;
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

export type PublicReview = Pick<Selectable<Reviews>, "id" | "reviewerName" | "reviewText" | "createdAt" | "userId"> & {
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