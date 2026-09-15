import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type MonthlyEarning = {
  month: string;
  year: number;
  earnings: number;
};

export type DashboardTopTest = {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  studentsEnrolled: number;
  price: number;
};

export type DashboardTopCourse = {
  id: number;
  title: string;
  thumbnailImageUrl: string | null;
  lessonsCount: number;
  price: number;
};

export type DashboardRecentSponsored = {
  id: number;
  studentName: string;
  contentTitle: string;
  enrolledAt: Date | null;
  commissionAmount: number;
};

export type OutputType = {
  counts: {
    totalTestsCount: number;
    publishedTestsCount: number;
    totalCoursesCount: number;
    publishedCoursesCount: number;
    totalBundlesCount: number;
    publishedBundlesCount: number;
    totalProductsCount: number;
    publishedProductsCount: number;
  };
  totalUniqueStudents: number;
  topTests: DashboardTopTest[];
  topCourses: DashboardTopCourse[];
  monthlyEarnings: MonthlyEarning[];
  recentSponsored: DashboardRecentSponsored[];
  availableBalance: number;
};

export const getTeacherDashboardStats = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/dashboard/stats`, {
    method: "GET",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Failed to fetch dashboard stats");
  }

  return superjson.parse<OutputType>(await result.text());
};