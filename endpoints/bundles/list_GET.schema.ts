import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { CourseBundles, Users } from "../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z
    .enum(["newest", "popular", "price_asc", "price_desc"])
    .optional(),
  teacherId: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  examId: z.coerce.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type BundleListItem = Omit<
  Selectable<CourseBundles>,
  "price" | "originalPrice" | "discountPercentage"
> & {
  price: number;
  originalPrice: number;
  discountPercentage: number | null;
  teacherName: Selectable<Users>["displayName"];
  teacherIsVerified: boolean;
  itemCount: number;
  courseTitles: string[];
};

export type OutputType = {
  bundles: BundleListItem[];
  total: number;
  page: number;
  limit: number;
};

export const getBundlesList = async (
  params?: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params || {});
  const searchParams = new URLSearchParams();

  Object.entries(validatedParams).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.append(key, String(value));
    }
  });

  const result = await fetch(`/_api/bundles/list?${searchParams.toString()}`, {
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