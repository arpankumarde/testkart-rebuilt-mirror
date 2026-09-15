import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAdminStudentBankDetailsList, 
  type InputType as ListInputType 
} from "../endpoints/admin/student-bank-details/list_GET.schema";
import { 
  postAdminVerifyStudentBankDetails, 
  type InputType as VerifyInputType 
} from "../endpoints/admin/student-bank-details/verify_POST.schema";

export const ADMIN_STUDENT_BANK_DETAILS_QUERY_KEY = ["admin", "student-bank-details"];

export const useAdminStudentBankDetailsList = (params: ListInputType) => {
  return useQuery({
    queryKey: [...ADMIN_STUDENT_BANK_DETAILS_QUERY_KEY, params],
    queryFn: () => getAdminStudentBankDetailsList(params),
    placeholderData: (previousData) => previousData,
  });
};

export const useVerifyStudentBankDetails = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyInputType) => postAdminVerifyStudentBankDetails(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_STUDENT_BANK_DETAILS_QUERY_KEY });
    },
  });
};