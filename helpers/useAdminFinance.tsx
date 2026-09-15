import { useQuery } from "@tanstack/react-query";
import { getAdminFinanceSummary, InputType } from "../endpoints/admin/finance/summary_GET.schema";

export const ADMIN_FINANCE_QUERY_KEY = "admin-finance";

export const useAdminFinanceSummaryQuery = (params: InputType) => {
  return useQuery({
    queryKey: [ADMIN_FINANCE_QUERY_KEY, params],
    queryFn: () => getAdminFinanceSummary(params),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};