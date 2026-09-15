import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStudentBankDetails,
  OutputType as BankDetailsType,
} from "../endpoints/student/bank-details_GET.schema";
import {
  postStudentBankDetailsAdd,
  InputType as AddBankDetailsInput,
} from "../endpoints/student/bank-details/add_POST.schema";

export const STUDENT_BANK_DETAILS_QUERY_KEY = ["student", "bankDetails"] as const;

export const useStudentBankDetailsQuery = () => {
  return useQuery<BankDetailsType, Error>({
    queryKey: STUDENT_BANK_DETAILS_QUERY_KEY,
    queryFn: () => getStudentBankDetails(),
  });
};

export const useAddStudentBankDetails = () => {
  const queryClient = useQueryClient();

  return useMutation<BankDetailsType, Error, AddBankDetailsInput>({
    mutationFn: (details) => postStudentBankDetailsAdd(details),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: STUDENT_BANK_DETAILS_QUERY_KEY,
      });
    },
  });
};