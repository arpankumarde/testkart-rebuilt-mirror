import { z } from "zod";
import superjson from "superjson";
import type { OrganizationTypeValue } from "../teacher/organizations/create_POST.schema";

export const schema = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: z.coerce.number().max(10).default(5).optional(),
});

export type InputType = z.infer<typeof schema>;

export type SearchResultItem = {
  id: number;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  discountPrice?: number | null;
  originalPrice?: number | null;
  teacherName: string;
  teacherIsVerified: boolean;
  views: number;
  type: "test" | "course" | "bundle" | "product";
  category: string | null;
  itemCount?: number;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
    teacherSlug: string | null;
  examName?: string | null;
};

export type SearchTeacherItem = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  slug: string;
  isVerified: boolean;
  testCount: number;
  courseCount: number;
  studentCount: number;
};

export type SearchOrganizationItem = {
  id: string;
  name: string;
  slug: string;
  orgType: OrganizationTypeValue;
  logoUrl: string | null;
  location: string | null;
  teacherCount: number;
  followerCount: number;
};

export type OutputType = {
  tests: SearchResultItem[];
  courses: SearchResultItem[];
  bundles: SearchResultItem[];
  products: SearchResultItem[];
  teachers: SearchTeacherItem[];
  organizations: SearchOrganizationItem[];
  totalResults: number;
};

export const getHomepageSearch = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams();
  searchParams.set("q", validatedParams.q);
  if (validatedParams.limit) {
    searchParams.set("limit", validatedParams.limit.toString());
  }

  const result = await fetch(`/_api/homepage/search?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Search failed");
  }

  return superjson.parse<OutputType>(await result.text());
};