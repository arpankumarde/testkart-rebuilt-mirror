import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalyticsRange } from "./teacherAnalyticsTime";
import { getTeacherAnalyticsSummary } from "../endpoints/teacher/analytics/summary_GET.schema";
import { getTeacherAnalyticsSales } from "../endpoints/teacher/analytics/sales_GET.schema";
import {
  getTeacherAnalyticsProducts,
  InputType as ProductsInput,
} from "../endpoints/teacher/analytics/products_GET.schema";
import { getTeacherAnalyticsStudents } from "../endpoints/teacher/analytics/students_GET.schema";
import { getTeacherAnalyticsReviews } from "../endpoints/teacher/analytics/reviews_GET.schema";
import { getTeacherAnalyticsAcademy } from "../endpoints/teacher/analytics/academy_GET.schema";
import { getTeacherAnalyticsPayments } from "../endpoints/teacher/analytics/payments_GET.schema";

export const TEACHER_ANALYTICS_QUERY_KEY = ["teacher", "analytics"] as const;

// The app-wide client never refetches on mount, so a stale tab would keep
// showing old numbers when reopened. Each tab fetches only its own endpoint,
// which keeps CN1 serving one section at a time.
const OPTIONS = {
  staleTime: 5 * 60 * 1000,
  refetchOnMount: true,
  placeholderData: <T,>(previous: T | undefined) => previous,
} as const;

export const useTeacherAnalyticsSummary = (range: AnalyticsRange, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_ANALYTICS_QUERY_KEY, "summary", range],
    queryFn: () => getTeacherAnalyticsSummary({ range }),
    enabled,
    ...OPTIONS,
  });

export const useTeacherAnalyticsSales = (range: AnalyticsRange, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_ANALYTICS_QUERY_KEY, "sales", range],
    queryFn: () => getTeacherAnalyticsSales({ range }),
    enabled,
    ...OPTIONS,
  });

export const useTeacherAnalyticsProducts = (input: ProductsInput, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_ANALYTICS_QUERY_KEY, "products", input],
    queryFn: () => getTeacherAnalyticsProducts(input),
    enabled,
    ...OPTIONS,
  });

export const useTeacherAnalyticsStudents = (range: AnalyticsRange, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_ANALYTICS_QUERY_KEY, "students", range],
    queryFn: () => getTeacherAnalyticsStudents({ range }),
    enabled,
    ...OPTIONS,
  });

export const useTeacherAnalyticsReviews = (range: AnalyticsRange, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_ANALYTICS_QUERY_KEY, "reviews", range],
    queryFn: () => getTeacherAnalyticsReviews({ range }),
    enabled,
    ...OPTIONS,
  });

export const useTeacherAnalyticsAcademy = (range: AnalyticsRange, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_ANALYTICS_QUERY_KEY, "academy", range],
    queryFn: () => getTeacherAnalyticsAcademy({ range }),
    enabled,
    ...OPTIONS,
  });

export const useTeacherAnalyticsPayments = (range: AnalyticsRange, page: number, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_ANALYTICS_QUERY_KEY, "payments", range, page],
    queryFn: () => getTeacherAnalyticsPayments({ range, page }),
    enabled,
    ...OPTIONS,
  });

/** Marks every Analytics query stale; the open tab and the KPI strip refetch at once. */
export const useRefreshTeacherAnalytics = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: TEACHER_ANALYTICS_QUERY_KEY });
};