import { useQuery } from "@tanstack/react-query";
import { getAdminEarningsList } from "../endpoints/admin/earnings/list_GET.schema";

export const ADMIN_EARNINGS_QUERY_KEY = "admin-earnings";

export const useAdminEarningsQuery = ({
  search = "",
  page = 1,
  limit = 20,
  sortBy,
  sortOrder,
}: {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  return useQuery({
    queryKey: [
      ADMIN_EARNINGS_QUERY_KEY,
      { search, page, limit, sortBy, sortOrder },
    ],
    queryFn: () =>
      getAdminEarningsList({
        search,
        page,
        limit,
        sortBy: sortBy as any,
        sortOrder,
      }),
  });
};