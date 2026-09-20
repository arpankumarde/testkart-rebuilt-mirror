import { useQuery } from "@tanstack/react-query";
import { getAdminSubscriptionsList, SubscriptionSortColumn } from "../endpoints/admin/subscriptions/list_GET.schema";
import { SubscriptionStatus } from "./schema";

export const useAdminSubscriptionsQuery = ({
  search = "",
  page = 1,
  limit = 20,
  planId,
  status,
  includeFree,
  expiringWithin7Days,
  sortBy,
  sortOrder,
}: {
  search?: string;
  page?: number;
  limit?: number;
  planId?: number;
  status?: SubscriptionStatus;
  includeFree?: boolean;
  expiringWithin7Days?: boolean;
  sortBy?: SubscriptionSortColumn;
  sortOrder?: "asc" | "desc";
}) => {
  return useQuery({
    queryKey: [
      "admin",
      "subscriptions",
      { search, page, limit, planId, status, includeFree, expiringWithin7Days, sortBy, sortOrder },
    ],
    queryFn: () =>
      getAdminSubscriptionsList({ search, page, limit, planId, status, includeFree, expiringWithin7Days, sortBy, sortOrder }),
  });
};