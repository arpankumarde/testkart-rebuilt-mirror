import { z } from "zod";
import superjson from "superjson";
import { WithdrawalStatus, WithdrawalStatusArrayValues, BankVerificationStatus } from "../../../helpers/schema";

export const StudentWithdrawalSortColumns = ["name", "amount", "status"] as const;
export type StudentWithdrawalSortColumn = (typeof StudentWithdrawalSortColumns)[number];

export const schema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(WithdrawalStatusArrayValues).optional(),
  search: z.string().optional(),
  sortBy: z.enum(StudentWithdrawalSortColumns).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type InputType = z.infer<typeof schema>;

export type AdminStudentWithdrawalRecord = {
  id: number;
  studentId: number;
  amount: number;
  status: WithdrawalStatus;
  requestedDate: Date | null;
  processedDate: Date | null;
  transactionId: string | null;
  notes: string | null;
  studentName: string;
  studentEmail: string | null;
  studentMobile: string | null;
  bankVerificationStatus: BankVerificationStatus | null;
  bankName: string | null;
  bankAccountHolderName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankUpiId: string | null;
  /** Student's current available wallet balance at time of this request */
  currentWalletBalance: number;
};

export type OutputType = {
  withdrawals: AdminStudentWithdrawalRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
};

export const getAdminStudentWithdrawalsList = async (
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

  const result = await fetch(`/_api/admin/student-withdrawals/list?${queryParams.toString()}`, {
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