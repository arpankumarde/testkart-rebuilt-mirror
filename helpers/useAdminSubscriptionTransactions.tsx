import { useQuery } from "@tanstack/react-query";
import { getAdminSubscriptionTransactions } from "../endpoints/admin/subscription-transactions/list_GET.schema";

export const useAdminSubscriptionTransactions = () => {
  return useQuery({
    queryKey: ["admin", "subscription-transactions"],
    queryFn: () => getAdminSubscriptionTransactions(),
  });
};