import { useMutation } from "@tanstack/react-query";
import { postCancelSubscription, InputType, OutputType } from "../endpoints/admin/subscriptions/cancel_POST.schema";

export function useAdminCancelSubscription() {
  return useMutation<OutputType, Error, InputType>({
    mutationFn: postCancelSubscription,
  });
}