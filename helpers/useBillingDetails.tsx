import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBillingDetails } from "../endpoints/account/billing-details_GET.schema";
import {
  postBillingDetails,
  InputType as BillingDetailsInput,
} from "../endpoints/account/billing-details_POST.schema";
import { postBillingState, InputType as BillingStateInput } from "../endpoints/account/billing-state_POST.schema";

export const BILLING_DETAILS_QUERY_KEY = ["account", "billing-details"] as const;

export const useBillingDetailsQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: BILLING_DETAILS_QUERY_KEY,
    queryFn: () => getBillingDetails(),
    enabled: options?.enabled ?? true,
  });
};

export const useUpdateBillingDetailsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BillingDetailsInput) => postBillingDetails(data),
    onSuccess: (data) => {
      queryClient.setQueryData(BILLING_DETAILS_QUERY_KEY, data);
    },
  });
};

export const useUpdateBillingStateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BillingStateInput) => postBillingState(data),
    onSuccess: (data) => {
      queryClient.setQueryData(BILLING_DETAILS_QUERY_KEY, data);
    },
  });
};
