import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminBankDetailsList, type InputType as ListInputType } from "../endpoints/admin/bank-details/list_GET.schema";
import { postAdminVerifyBankDetails, type InputType as VerifyInputType } from "../endpoints/admin/bank-details/verify_POST.schema";

export const ADMIN_BANK_DETAILS_QUERY_KEY = "admin-bank-details";

export const useAdminBankDetailsQuery = (params: ListInputType) => {
  return useQuery({
    queryKey: [ADMIN_BANK_DETAILS_QUERY_KEY, params],
    queryFn: () => getAdminBankDetailsList(params),
  });
};

export const useVerifyBankDetailsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyInputType) => postAdminVerifyBankDetails(data),
    onSuccess: () => {
      // Invalidate all queries related to bank details to refetch the list
      queryClient.invalidateQueries({ queryKey: [ADMIN_BANK_DETAILS_QUERY_KEY] });
    },
  });
};