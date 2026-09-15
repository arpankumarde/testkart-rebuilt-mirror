import { useMutation } from "@tanstack/react-query";
import { postResendOrderEmails, InputType, OutputType } from "../endpoints/admin/orders/resend-emails_POST.schema";

export function useResendOrderEmails() {
  return useMutation<OutputType, Error, InputType>({
    mutationFn: async (data: InputType) => {
      return await postResendOrderEmails(data);
    },
  });
}