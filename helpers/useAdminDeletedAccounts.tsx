import { useQuery } from "@tanstack/react-query";
import { getAdminDeletedAccountsList } from "../endpoints/admin/deleted-accounts/list_GET.schema";

export const ADMIN_DELETED_ACCOUNTS_QUERY_KEY = "admin-deleted-accounts";

export const useAdminDeletedAccountsQuery = ({
  search = "",
  page = 1,
}: {
  search?: string;
  page?: number;
}) => {
  return useQuery({
    queryKey: [ADMIN_DELETED_ACCOUNTS_QUERY_KEY, { search, page }],
    queryFn: () =>
      getAdminDeletedAccountsList({
        search,
        page,
        limit: 20,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};