import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postAdminAddWithdrawal } from "../endpoints/admin/earnings/add-withdrawal_POST.schema";
import { ADMIN_EARNINGS_QUERY_KEY } from "./useAdminEarnings";

export const useAddWithdrawalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postAdminAddWithdrawal,
    onSuccess: () => {
      // Invalidate all earnings queries to refetch the list and reflect the new balance.
      queryClient.invalidateQueries({ queryKey: [ADMIN_EARNINGS_QUERY_KEY] });
    },
  });
};