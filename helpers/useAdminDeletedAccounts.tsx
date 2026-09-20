import { useQuery } from "@tanstack/react-query";
import {
  getAdminDeletedAccountsList,
  DeletedAccountSortBy,
} from "../endpoints/admin/deleted-accounts/list_GET.schema";

export const ADMIN_DELETED_ACCOUNTS_QUERY_KEY = "admin-deleted-accounts";

export const useAdminDeletedAccountsQuery = ({
  search = "",
  page = 1,
  sortBy,
  sortOrder,
}: {
  search?: string;
  page?: number;
  sortBy?: DeletedAccountSortBy;
  sortOrder?: "asc" | "desc";
}) => {
  return useQuery({
    queryKey: [ADMIN_DELETED_ACCOUNTS_QUERY_KEY, { search, page, sortBy, sortOrder }],
    queryFn: () =>
      getAdminDeletedAccountsList({
        search,
        page,
        limit: 20,
        sortBy,
        sortOrder,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};