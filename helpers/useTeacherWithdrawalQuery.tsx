import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherWithdrawals } from "../endpoints/teacher/withdrawal/list_GET.schema";
import { postRequestWithdrawal, InputType as RequestInputType } from "../endpoints/teacher/withdrawal/request_POST.schema";
import { TEACHER_EARNINGS_BALANCE_QUERY_KEY } from "./useTeacherSponsoredEnrollments";

export const TEACHER_WITHDRAWALS_QUERY_KEY = ["teacher", "withdrawals"];

export const useTeacherWithdrawals = () => {
  return useQuery({
    queryKey: TEACHER_WITHDRAWALS_QUERY_KEY,
    queryFn: () => getTeacherWithdrawals(),
    staleTime: 15 * 60 * 1000,
  });
};

export const useRequestWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RequestInputType) => postRequestWithdrawal(data),
    onSuccess: () => {
      // Invalidate withdrawals list to show the new pending request
      queryClient.invalidateQueries({ queryKey: TEACHER_WITHDRAWALS_QUERY_KEY });
      // Invalidate balance because pending withdrawals are now deducted from available balance
      queryClient.invalidateQueries({ queryKey: TEACHER_EARNINGS_BALANCE_QUERY_KEY });
    },
  });
};