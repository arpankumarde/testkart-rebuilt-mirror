import { z } from "zod";
import superjson from "superjson";

export const SORT_VALUES = ["recommended", "price_asc", "price_desc", "rating"] as const;
export type ExpertSortValue = (typeof SORT_VALUES)[number];

export const schema = z.object({
  search: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  sortBy: z.enum(SORT_VALUES).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(48).optional(),
});
export type InputType = z.infer<typeof schema>;

export type ExpertListItem = {
  id: number;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  tagline: string | null;
  bio: string | null;
  location: string | null;
  academyName: string | null;
  isVerified: boolean;
  yearsOfExperience: number | null;
  expertiseAreas: string[];
  teachingCategories: string[];
  languages: string[];
  mentorshipEnabled: boolean;
  /** Price in INR for a full session (50 min) 1:1 class, when the teacher has 1:1 enabled. */
  priceFull: number | null;
  /** Price in INR for a full session trial class, when the teacher has 1:1 enabled. */
  trialPriceFull: number | null;
  /** Cheapest trial class in INR (the lower of the short and full session trial prices), when 1:1 is enabled. */
  trialFrom: number | null;
  rating: number | null;
  reviewsCount: number;
  studentsCount: number;
  /** Completed 1:1 sessions plus completed group lessons. */
  lessonsCount: number;
};

export type OutputType = {
  teachers: ExpertListItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  priceBounds: { min: number; max: number };
};

export const getExpertsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.search) params.set("search", input.search);
  if (input.minPrice != null) params.set("minPrice", String(input.minPrice));
  if (input.maxPrice != null) params.set("maxPrice", String(input.maxPrice));
  if (input.verifiedOnly) params.set("verifiedOnly", "true");
  if (input.sortBy) params.set("sortBy", input.sortBy);
  if (input.page) params.set("page", String(input.page));
  if (input.limit) params.set("limit", String(input.limit));
  const result = await fetch(`/_api/experts/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
