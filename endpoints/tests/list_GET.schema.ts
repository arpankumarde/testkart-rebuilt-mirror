import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests, Users } from "../../helpers/schema";

export const schema = z.object({
  search: z.string().optional(),
  examId: z.string().optional(),
  language: z.string().optional(), // comma-separated
  priceType: z.enum(['all', 'free', 'paid']).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sortBy: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'rating']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type TestListItem = Omit<
  Pick<
    Selectable<MockTests>,
    | "id"
    | "slug"
    | "title"
    | "description"
    | "subject"
    | "price"
    | "discountPrice"
    | "durationMinutes"
    | "totalQuestions"
    | "thumbnailUrl"
    | "introVideoUrl"
    | "totalTests"
    | "freeTestsCount"
    | "creatorName"
    | "studentsEnrolled"
    | "rating"
    | "reviewsCount"
    | "examName"
    | "language"
  >,
  "price" | "discountPrice" | "rating"
> & {
  teacherName: Selectable<Users>["displayName"];
  teacherIsVerified: boolean;
  isEnrolled: boolean;
  actualQuestionCount: number;
  price: number;
  discountPrice: number | null;
  rating: number | null;
  examSlug: string | null;
  views: number;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
  teacherSlug: string | null;
};

export type OutputType = {
  tests: TestListItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

export const getTestsList = async (
  filters: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  
  if (filters.search) params.append('search', filters.search);
  if (filters.examId) params.append('examId', filters.examId);
  if (filters.language) params.append('language', filters.language);
  if (filters.priceType) params.append('priceType', filters.priceType);
  if (filters.minPrice) params.append('minPrice', filters.minPrice);
  if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);

  const queryString = params.toString();
  const url = `/_api/tests/list${queryString ? `?${queryString}` : ''}`;

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