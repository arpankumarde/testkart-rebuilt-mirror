import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Courses, CourseSections, CourseLessons, Users } from "../../helpers/schema";

export const schema = z.object({
  slug: z.string(),
});

export type InputType = z.infer<typeof schema>;

type PublicLesson = Pick<
  Selectable<CourseLessons>,
  "id" | "sectionId" | "title" | "contentType" | "durationMinutes" | "isPreview" | "orderIndex"
> & {
  contentUrl?: string | null;
  textContent?: string | null;
};

type PublicSectionWithLessons = Selectable<CourseSections> & {
  lessons: PublicLesson[];
};

type CourseReview = {
  id: number;
  rating: number;
  reviewText: string | null;
  createdAt: Date | null;
  userId: number;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
};

export type CourseSeo = {
  indexable: boolean;
  qualityScore: number;
  robots: "index,follow" | "noindex,follow";
};

export type OutputType = Omit<Selectable<Courses>, "price"> & {
  price: number;
  seo: CourseSeo;
  teacher: {
    id: number;
    displayName: string;
    profilePicture: string | null;
    isVerified: boolean;
    slug: string;
    bio: string | null;
    academyName: string | null;
  };
  sections: PublicSectionWithLessons[];
  reviews: CourseReview[];
  isEnrolled: boolean;
  disclaimer: string;
};

export const getCoursesDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    slug: validatedParams.slug,
  });

  const result = await fetch(
    `/_api/courses/details?${searchParams.toString()}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};