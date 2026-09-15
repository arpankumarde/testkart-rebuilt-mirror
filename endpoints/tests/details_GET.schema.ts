import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTests, MockTestItems, Users } from "../../helpers/schema";
import { SocialLinks, AwardCertificate } from "../../helpers/teacherProfileTypes";

export const schema = z
  .object({
    id: z.number().int().positive().optional(),
    slug: z.string().min(1).optional(),
  })
  .refine((data) => data.id !== undefined || data.slug !== undefined, {
    message: "Either 'id' or 'slug' must be provided",
  });

export type InputType = z.infer<typeof schema>;

export type PackageSeo = {
  indexable: boolean;
  qualityScore: number;
  robots: "index,follow" | "noindex,follow";
};

export type PackageDetails = {
  id: number;
  title: string;
  description: string | null;
  subject: string | null;
  price: number;
  discountPrice: number | null;
  examName: string | null;
  examSlug: string | null;
  slug: string;
  teacherName: Selectable<Users>["displayName"];
  teacherAvatarUrl: Selectable<Users>["avatarUrl"];
  teacherId: number;
  teacherBio: Selectable<Users>["bio"];
  teacherWebsiteUrl: Selectable<Users>["websiteUrl"];
  teacherPublicPhone: Selectable<Users>["publicPhone"];
  teacherPublicEmail: Selectable<Users>["publicEmail"];
  teacherAcademyName: Selectable<Users>["academyName"];
  teacherSocialLinks: SocialLinks | null;
  teacherAwardsCertificates: AwardCertificate[] | null;
  rating: number | null;
  studentsEnrolled: number;
  reviewsCount: number;
  totalTests: number;
  freeTestsCount: number;
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
  creatorName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  isEnrolled: boolean;
  language: string | null;
  teacherSlug: string;
  teacherIsVerified: boolean;
  whatYouLearn: string[] | null;
  requirements: string[] | null;
  longDescription: string | null;
  disclaimer: string;
  seo: PackageSeo;
};

export type TestItem = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  totalQuestions: number;
  isFree: boolean;
  orderIndex: number;
  createdAt: Date | null;
  scheduledDate: Date | null;
  subjects: Array<{
    id: number;
    subjectName: string;
    actualQuestionCount: number;
  }>;
};

export type OutputType = {
  package: PackageDetails;
  items: TestItem[];
};

export const getTestsDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams();

  // Priority to slug if provided
  if (validatedParams.slug) {
    searchParams.set("slug", validatedParams.slug);
  } else if (validatedParams.id) {
    searchParams.set("id", validatedParams.id.toString());
  }

  const result = await fetch(`/_api/tests/details?${searchParams.toString()}`, {
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