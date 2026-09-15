import { useMutation } from "@tanstack/react-query";
import { postAccountCloseRequest } from "../endpoints/account/close-request_POST.schema";

export const useCloseAccountMutation = () => {
  return useMutation({
    mutationFn: async (reason?: string) => {
      return await postAccountCloseRequest({ reason });
    },
  });
};