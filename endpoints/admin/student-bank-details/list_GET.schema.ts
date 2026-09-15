import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type StudentBankDetails, BankVerificationStatusArrayValues } from "../../../helpers/schema";

export const BankDetailsVerificationStatusFilterArray = ["all", ...BankVerificationStatusArrayValues] as const;

export const schema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  status: z.enum(BankDetailsVerificationStatusFilterArray).optional(),
});

export type InputType = z.infer<typeof schema>;

export type StudentBankDetailsAdminView = Selectable<StudentBankDetails> & {
  studentName: string;
  studentEmail: string;
};

export type OutputType = {
  bankDetails: StudentBankDetailsAdminView[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export const getAdminStudentBankDetailsList = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.status) queryParams.set("status", params.status);

  const result = await fetch(`/_api/admin/student-bank-details/list?${queryParams.toString()}`, {
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