import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAdminWithdrawals, 
  InputType as ListInputType, 
  OutputType as ListOutputType 
} from "../endpoints/admin/withdrawals/list_GET.schema";
import { 
  postProcessWithdrawal, 
  InputType as ProcessInputType, 
  OutputType as ProcessOutputType 
} from "../endpoints/admin/withdrawals/process_POST.schema";

export const ADMIN_WITHDRAWALS_QUERY_KEY = ["admin", "withdrawals"];

export const useAdminWithdrawalsQuery = (params: ListInputType) => {
  return useQuery<ListOutputType, Error>({
    queryKey: [...ADMIN_WITHDRAWALS_QUERY_KEY, params],
    queryFn: () => getAdminWithdrawals(params),
    placeholderData: (previousData) => previousData,
  });
};

export const useProcessWithdrawalMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<ProcessOutputType, Error, ProcessInputType>({
    mutationFn: (data) => postProcessWithdrawal(data),
    onSuccess: () => {
      // Invalidate the list query to refresh data
      queryClient.invalidateQueries({ queryKey: ADMIN_WITHDRAWALS_QUERY_KEY });
    },
  });
};