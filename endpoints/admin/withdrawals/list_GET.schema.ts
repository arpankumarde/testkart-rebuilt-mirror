import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherWithdrawals, WithdrawalStatus, WithdrawalStatusArrayValues, BankVerificationStatus } from "../../../helpers/schema";

export const TeacherWithdrawalSortColumns = ["name", "amount", "balance", "status"] as const;
export type TeacherWithdrawalSortColumn = (typeof TeacherWithdrawalSortColumns)[number];

export const schema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(WithdrawalStatusArrayValues).optional(),
  search: z.string().optional(),
  sortBy: z.enum(TeacherWithdrawalSortColumns).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type InputType = z.infer<typeof schema>;

export type AdminWithdrawalRecord = {
  id: number;
  teacherId: number;
  amount: number;
  status: WithdrawalStatus;
  requestedDate: Date | null;
  processedDate: Date | null;
  transactionId: string | null;
  notes: string | null;
  teacherName: string;
  teacherEmail: string | null;
  bankVerificationStatus: BankVerificationStatus | null;
  bankName: string | null;
  bankAccountHolderName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankUpiId: string | null;
  /** Available balance when the teacher made this request, before its amount came off. Null if never recorded. */
  balanceAtRequest: number | null;
};

export type OutputType = {
  withdrawals: AdminWithdrawalRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
};

export const getAdminWithdrawals = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  queryParams.set("page", params.page.toString());
  queryParams.set("limit", params.limit.toString());
  if (params.status) queryParams.set("status", params.status);
  if (params.search) queryParams.set("search", params.search);
  if (params.sortBy) queryParams.set("sortBy", params.sortBy);
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder);

  const result = await fetch(`/_api/admin/withdrawals/list?${queryParams.toString()}`, {
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