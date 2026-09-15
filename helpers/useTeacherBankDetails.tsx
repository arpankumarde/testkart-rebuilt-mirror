import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherBankDetails,
  OutputType as BankDetailsType,
} from "../endpoints/teacher/bank-details_GET.schema";
import {
  postTeacherBankDetailsAdd,
  InputType as AddBankDetailsInput,
} from "../endpoints/teacher/bank-details/add_POST.schema";

/**
 * React Query key for teacher bank details.
 */
export const TEACHER_BANK_DETAILS_QUERY_KEY = [
  "teacher",
  "bankDetails",
] as const;

/**
 * A React Query hook to fetch the authenticated teacher's bank details.
 *
 * @returns A query object with the teacher's bank details or null.
 */
export const useTeacherBankDetailsQuery = () => {
  return useQuery<BankDetailsType, Error>({
    queryKey: TEACHER_BANK_DETAILS_QUERY_KEY,
    queryFn: () => getTeacherBankDetails(),
  });
};

/**
 * A React Query mutation hook to add or update a teacher's bank details.
 *
 * On success, it invalidates the teacher bank details query to refetch the latest data.
 *
 * @returns A mutation object for adding/updating bank details.
 */
export const useAddOrUpdateBankDetailsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<BankDetailsType, Error, AddBankDetailsInput>({
    mutationFn: (details) => postTeacherBankDetailsAdd(details),
    onSuccess: () => {
      // Invalidate and refetch the bank details query to show the updated data
      queryClient.invalidateQueries({
        queryKey: TEACHER_BANK_DETAILS_QUERY_KEY,
      });
    },
  });
};