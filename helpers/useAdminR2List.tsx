import { useMutation } from "@tanstack/react-query";
import { postR2List, InputType, OutputType } from "../endpoints/admin/r2-list_POST.schema";

export const useAdminR2List = () => {
  return useMutation<OutputType, Error, InputType>({
    mutationFn: postR2List,
  });
};