import { z } from "zod";
import superjson from "superjson";

export const OverviewRangeValues = ["7d", "30d", "90d"] as const;
export type OverviewRange = (typeof OverviewRangeValues)[number];

export const schema = z.object({
  range: z.enum(OverviewRangeValues).default("7d"),
});

export type InputType = z.infer<typeof schema>;

/** Work queues. Every field is a count except the two amounts, which are rupees. */
export type AttentionCounts = {
  staleOrders: number;
  failedOrders7d: number;
  teacherWithdrawals: number;
  teacherWithdrawalsAmount: number;
  studentWithdrawals: number;
  studentWithdrawalsAmount: number;
  teacherBankPending: number;
  studentBankPending: number;
  supportOpen: number;
  supportUnread: number;
  inquiriesPending: number;
  contactNew: number;
  reviewsPending: number;
  demoRequestsNew: number;
  followupsOverdue: number;
  prizesUndistributed: number;
  subscriptionsExpiring7d: number;
  aiFailed7d: number;
  blogCommentsPending: number;
};

export type KpiPair = { current: number; previous: number };

export type OverviewKpis = {
  revenue: KpiPair;
  subscriptionRevenue: KpiPair;
  orders: KpiPair;
  paidOrders: KpiPair;
  failedOrders: KpiPair;
  newTeachers: KpiPair;
  newStudents: KpiPair;
  attempts: KpiPair;
  testsPublished: KpiPair;
};

/** One calendar day in Asia/Kolkata. `day` is YYYY-MM-DD. */
export type DailyPoint = {
  day: string;
  revenue: number;
  orders: number;
  teachers: number;
  students: number;
  attempts: number;
};

export const MixKindValues = [
  "mock_test",
  "digital_product",
  "course",
  "bundle",
  "live_test",
  "mentorship",
  "subscription",
  "other",
] as const;
export type MixKind = (typeof MixKindValues)[number];

export type MixSlice = { kind: MixKind; revenue: number; units: number };

export type TopSeller = {
  kind: MixKind;
  title: string;
  teacherName: string | null;
  units: number;
  revenue: number;
};

export type TopTeacher = {
  teacherId: number | null;
  name: string;
  units: number;
  revenue: number;
};

export type RecentOrder = {
  id: number;
  amount: number;
  status: string;
  createdAt: Date;
  studentName: string;
  itemCount: number;
  summary: string;
  paymentMethod: string | null;
};

export type PlatformTotals = {
  teachers: number;
  students: number;
  publishedTests: number;
  publishedCourses: number;
  publishedProducts: number;
  publishedBundles: number;
  activeLiveTests: number;
  activeSubscriptions: number;
  completedOrders: number;
  lifetimeRevenue: number;
};

export type OutputType = {
  range: OverviewRange;
  days: number;
  generatedAt: Date;
  attention: AttentionCounts;
  kpis: OverviewKpis;
  daily: DailyPoint[];
  mix: MixSlice[];
  topSellers: TopSeller[];
  topTeachers: TopTeacher[];
  recentOrders: RecentOrder[];
  totals: PlatformTotals;
};

export const getAdminDashboardOverview = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/admin/dashboard/overview?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
