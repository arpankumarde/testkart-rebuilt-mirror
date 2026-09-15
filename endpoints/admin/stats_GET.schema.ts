import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  // Top KPIs
  totalRevenue: number;
  totalTeachers: number;
  totalStudents: number;
  totalCompletedOrders: number;

  // This Month
  monthlyRevenue: number;
  monthlyNewTeachers: number;
  monthlyNewStudents: number;
  monthlyCompletedOrders: number;
  monthlyPublishedTests: number;

  // Content Counts
  publishedTests: number;
  publishedCourses: number;
  publishedProducts: number;
  publishedBundles: number;
  liveTests: number;
  completedTestAttempts: number;

  // Order status breakdown
  failedOrders: number;
  pendingOrders: number;

  // Chart: last 6 months revenue
  revenueHistory: Array<{ month: string; revenue: number }>;
  // Chart: last 6 months signups
  signupHistory: Array<{ month: string; teachers: number; students: number }>;
};

export const getAdminStats = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/stats`, {
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