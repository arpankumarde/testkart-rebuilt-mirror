import { useQuery } from "@tanstack/react-query";
import { getAdminSubscriptionsList } from "../endpoints/admin/subscriptions/list_GET.schema";
import { SubscriptionStatus } from "./schema";

export const useAdminSubscriptionsQuery = ({
  search = "",
  page = 1,
  limit = 20,
  planId,
  status,
  includeFree,
  expiringWithin7Days,
}: {
  search?: string;
  page?: number;
  limit?: number;
  planId?: number;
  status?: SubscriptionStatus;
  includeFree?: boolean;
  expiringWithin7Days?: boolean;
}) => {
  return useQuery({
    queryKey: ["admin", "subscriptions", { search, page, limit, planId, status, includeFree, expiringWithin7Days }],
    queryFn: () => getAdminSubscriptionsList({ search, page, limit, planId, status, includeFree, expiringWithin7Days }),
  });
};