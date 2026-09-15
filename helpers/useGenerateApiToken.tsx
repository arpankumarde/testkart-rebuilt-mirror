import { useMutation } from "@tanstack/react-query";
import { postApiToken } from "../endpoints/auth/api-token_POST.schema";

export const useGenerateApiToken = () => {
  return useMutation({
    mutationFn: async () => {
      return postApiToken({});
    },
  });
};