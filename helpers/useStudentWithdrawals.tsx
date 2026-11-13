import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStudentWithdrawals, OutputType as WithdrawalsOutputType } from "../endpoints/student/withdrawal/list_GET.schema";
import { postStudentWithdrawalRequest, InputType as RequestInputType, OutputType as RequestOutputType } from "../endpoints/student/withdrawal/request_POST.schema";
import { postCancelStudentWithdrawal, InputType as CancelInputType, OutputType as CancelOutputType } from "../endpoints/student/withdrawal/cancel_POST.schema";
import { STUDENT_WALLET_BALANCE_QUERY_KEY } from "./useStudentWallet";

export const STUDENT_WITHDRAWALS_QUERY_KEY = ["student", "withdrawals"] as const;

export const useStudentWithdrawalsList = () => {
  return useQuery<WithdrawalsOutputType, Error>({
    queryKey: STUDENT_WITHDRAWALS_QUERY_KEY,
    queryFn: () => getStudentWithdrawals(),
  });
};

export const useRequestStudentWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation<RequestOutputType, Error, RequestInputType>({
    mutationFn: (data) => postStudentWithdrawalRequest(data),
    onSuccess: () => {
      // Invalidate withdrawals list to reflect new request
      queryClient.invalidateQueries({ queryKey: STUDENT_WITHDRAWALS_QUERY_KEY });
      // Invalidate balance since a pending withdrawal reduces available balance
      queryClient.invalidateQueries({ queryKey: STUDENT_WALLET_BALANCE_QUERY_KEY });
    },
    onError: () => {
      // A refusal such as the daily limit means the list is out of date
      queryClient.invalidateQueries({ queryKey: STUDENT_WITHDRAWALS_QUERY_KEY });
    },
  });
};

/* Cancels a pending request. Success or refusal, the list, balance and transactions are refetched, since either means they changed. */
export const useCancelStudentWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation<CancelOutputType, Error, CancelInputType>({
    mutationFn: (data) => postCancelStudentWithdrawal(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: STUDENT_WITHDRAWALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["student", "wallet"] });
    },
  });
};