import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherWithdrawals } from "../endpoints/teacher/withdrawal/list_GET.schema";
import { postRequestWithdrawal, InputType as RequestInputType } from "../endpoints/teacher/withdrawal/request_POST.schema";
import { postCancelTeacherWithdrawal, InputType as CancelInputType } from "../endpoints/teacher/withdrawal/cancel_POST.schema";
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
    onError: () => {
      // A refusal such as the daily limit means the list is out of date
      queryClient.invalidateQueries({ queryKey: TEACHER_WITHDRAWALS_QUERY_KEY });
    },
  });
};

/* Cancels a pending request. Success or refusal, the list and balance are refetched, since either means they changed. */
export const useCancelTeacherWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CancelInputType) => postCancelTeacherWithdrawal(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_WITHDRAWALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_EARNINGS_BALANCE_QUERY_KEY });
    },
  });
};