import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAdminStudentWithdrawalsList, 
  InputType as ListInputType, 
  OutputType as ListOutputType 
} from "../endpoints/admin/student-withdrawals/list_GET.schema";
import { 
  postProcessStudentWithdrawal, 
  InputType as ProcessInputType, 
  OutputType as ProcessOutputType 
} from "../endpoints/admin/student-withdrawals/process_POST.schema";

export const ADMIN_STUDENT_WITHDRAWALS_QUERY_KEY = ["admin", "student-withdrawals"];

export const useAdminStudentWithdrawalsList = (params: ListInputType) => {
  return useQuery<ListOutputType, Error>({
    queryKey: [...ADMIN_STUDENT_WITHDRAWALS_QUERY_KEY, params],
    queryFn: () => getAdminStudentWithdrawalsList(params),
    placeholderData: (previousData) => previousData,
  });
};

export const useProcessStudentWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation<ProcessOutputType, Error, ProcessInputType>({
    mutationFn: (data) => postProcessStudentWithdrawal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_STUDENT_WITHDRAWALS_QUERY_KEY });
    },
  });
};