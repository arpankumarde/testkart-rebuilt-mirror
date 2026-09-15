import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseBundles } from "../../../helpers/schema";

export const schema = z.object({
  bundleId: z.number(),
});

export type InputType = z.infer<typeof schema>;

// Every item in the bundle with its current title, price and publish state,
// so the edit form can show items that are unpublished or not in its lists.
export type BundleDetailItem = {
  itemType: "course" | "test" | "digital_product";
  id: number;
  title: string;
  price: number;
  isPublished: boolean;
};

export type OutputType = Omit<Selectable<CourseBundles>, "price" | "originalPrice" | "discountPercentage"> & {
  price: number;
  originalPrice: number;
  discountPercentage: number | null;
  courseIds: number[];
  testIds: number[];
  digitalProductIds: number[];
  itemCount: number;
  items: BundleDetailItem[];
};

export const getTeacherBundleDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  searchParams.set("bundleId", params.bundleId.toString());

  const result = await fetch(`/_api/teacher/bundles/details?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.details || errorObject.error);
  }
  
  return superjson.parse<OutputType>(await result.text());
};