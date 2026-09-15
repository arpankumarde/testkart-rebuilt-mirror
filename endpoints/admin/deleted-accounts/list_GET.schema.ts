import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type DeletedAccountView = {
  id: number;
  displayName: string;
  email: string | null;
  mobileNumber: string | null;
  role: string;
  reason: string | null;
  registeredAt: Date | null;
  deletedAt: Date;
  originalUserId: number;
};

export type OutputType = {
  accounts: DeletedAccountView[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export const getAdminDeletedAccountsList = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());

  const result = await fetch(`/_api/admin/deleted-accounts/list?${queryParams.toString()}`, {
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