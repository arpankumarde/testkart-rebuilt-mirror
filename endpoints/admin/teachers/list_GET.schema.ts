import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  sortBy: z.enum(["name", "email", "createdAt", "testsCount", "bundlesCount", "coursesCount", "liveTestsCount", "productsCount", "totalEarnings"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type InputType = z.infer<typeof schema>;

export type TeacherAdminView = {
  id: number;
  fullName: string;
  email: string;
  mobileNumber: string | null;
  academyName: string | null;
  createdAt: Date | null;
  isActive: boolean;
  isVerified: boolean;
  testsCount: number;
  bundlesCount: number;
  coursesCount: number;
  liveTestsCount: number;
  productsCount: number;
  totalEarnings: number;
  onboardingCompleted: boolean;
  instituteType: string | null;
  location: string | null;
  bio: string | null;
  tagline: string | null;
  expertiseAreas: unknown;
  languages: unknown;
  socialLinks: unknown;
  yearsOfExperience: number | null;
  teachingCategories: unknown;
  targetExams: unknown;
  teachingExperienceLevel: string | null;
  currentOccupation: string | null;
  goals: string | null;
  discoverySource: string | null;
  schoolCollegeName: string | null;
  signupSource: string | null;
  productInterest: unknown;
  websiteUrl: string | null;
};

export type OutputType = {
  teachers: TeacherAdminView[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export const getAdminTeachersList = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.sortBy) queryParams.set("sortBy", params.sortBy);
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder);

  const result = await fetch(`/_api/admin/teachers/list?${queryParams.toString()}`, {
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