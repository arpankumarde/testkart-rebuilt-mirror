import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts, DigitalProductPurchases } from "../../../helpers/schema";

export const schema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type InputType = z.infer<typeof schema>;

export type StudentPurchaseItem = {
  purchaseId: number;
  purchasedAt: Date | null;
  downloadCount: number;
  lastDownloadedAt: Date | null;
  productId: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  category: string | null;
  teacherName: string;
  fileCount: number;
  hasReviewed: boolean;
  reviewRating: number | null;
  reviewText: string | null;
};

export type OutputType = {
  purchases: StudentPurchaseItem[];
  page: number;
  limit: number;
};

export const getStudentPurchases = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  queryParams.set("page", params.page.toString());
  queryParams.set("limit", params.limit.toString());

  const result = await fetch(`/_api/student/shop/purchases?${queryParams.toString()}`, {
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