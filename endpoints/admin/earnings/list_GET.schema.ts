import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  sortBy: z.enum(["name", "email", "totalEarnings", "totalWithdrawals", "pendingWithdrawals", "availableBalance", "transactionsCount", "totalPrizeDeductions", "totalSubscriptionWalletPayments"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type InputType = z.infer<typeof schema>;

export type TeacherEarningAdminView = {
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  totalEarnings: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  totalSponsored: number;
  totalPrizeDeductions: number;
  totalSubscriptionWalletPayments: number;
  availableBalance: number;
  transactionsCount: number;
};

export type OutputType = {
  earnings: TeacherEarningAdminView[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export const getAdminEarningsList = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.sortBy) queryParams.set("sortBy", params.sortBy);
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder);

  const result = await fetch(`/_api/admin/earnings/list?${queryParams.toString()}`, {
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