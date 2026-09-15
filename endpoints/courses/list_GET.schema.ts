import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses, Users } from "../../helpers/schema";

export const schema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  language: z.string().optional(), // comma-separated
  priceType: z.enum(["all", "free", "paid"]).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sortBy: z.enum(["newest", "price_asc", "price_desc", "popular"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  examId: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type CourseListItem = Pick<
  Selectable<Courses>,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "thumbnailUrl"
  | "thumbnailImageUrl"
  | "introVideoUrl"
  | "category"
  | "level"
  | "language"
  | "status"
  | "publishedAt"
  | "examId"
  | "examName"
> & {
  teacherName: Selectable<Users>["displayName"];
  teacherSlug: string;
  teacherIsVerified: boolean;
  enrollmentCount: number;
  price: number; // Convert from Numeric to number
  views: number;
  avgRating: number | null;
  ratingsCount: number;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
};

export type OutputType = {
  courses: CourseListItem[];
  categories: string[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

export const getCoursesList = async (
  filters: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.level) params.append("level", filters.level);
  if (filters.language) params.append("language", filters.language);
  if (filters.priceType) params.append("priceType", filters.priceType);
  if (filters.minPrice) params.append("minPrice", filters.minPrice);
  if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.page) params.append("page", filters.page);
  if (filters.limit) params.append("limit", filters.limit);
  if (filters.examId) params.append("examId", filters.examId);

  const queryString = params.toString();
  const url = `/_api/courses/list${queryString ? `?${queryString}` : ""}`;

  const result = await fetch(url, {
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