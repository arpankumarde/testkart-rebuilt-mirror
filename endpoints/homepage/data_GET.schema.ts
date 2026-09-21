import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type HomepageTestItem = {
  id: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  examName: string | null;
  totalTests: number;
  price: number;
  discountPrice: number | null;
  studentsEnrolled: number;
  rating: number | null;
  reviewsCount: number;
  teacherName: string;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
      teacherIsVerified: boolean;
  views: number;
};

export type HomepageCourseItem = {
  id: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number;
  studentsEnrolled: number;
  rating: number | null;
  totalLessons: number;
  teacherName: string;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
  teacherIsVerified: boolean;
  views: number;
};

export type HomepageFeaturedCourseItem = {
  id: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number;
  examName: string | null;
  level: "beginner" | "intermediate" | "advanced" | null;
  totalLessons: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
  teacherIsVerified: boolean;
};

export type HomepageNoteItem = {
  id: number;
  title: string;
  slug: string;
  price: number;
  totalPurchases: number;
  rating: number | null;
  pageCount: number | null;
  teacherName: string;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
    teacherIsVerified: boolean;
  views: number;
  examName: string | null;
};

export type HomepageLiveTestSpotlight = {
  id: number;
  title: string;
  examName: string | null;
  price: number;
  enrolledCount: number;
  maxSeats: number;
  hasPrizes: boolean;
  totalPrizePool: number;
  startTime: Date;
  endTime: Date;
  teacherName: string;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
  teacherIsVerified: boolean;
};

export type HomepageBundleItem = {
  id: number;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  originalPrice: number;
  discountPercentage: number | null;
  teacherName: string;
  teacherIsVerified: boolean;
  itemCount: number;
};

export type HomepageMixedItem = {
  id: number;
  type: "test" | "course" | "liveTest" | "bundle" | "product";
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number;
  discountPrice: number | null;
  teacherName: string;
  teacherIsVerified: boolean;
  views: number;
  publishedAt: Date | null;
};

export type HomepageTeacher = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  slug: string;
  isVerified: boolean;
  tagline: string | null;
  testCount: number;
  courseCount: number;
  productCount: number;
  studentCount: number;
  targetExams: string[] | null;
};

export type OutputType = {
  topMockTests: HomepageTestItem[];
  popularCourses: HomepageCourseItem[];
  featuredCourses: HomepageFeaturedCourseItem[];
  popularNotes: HomepageNoteItem[];
  liveTestSpotlight: HomepageLiveTestSpotlight[];
  popularTeachers: HomepageTeacher[];
};

export const getHomepageData = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/homepage/data`, {
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