import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postAdminLiveLessonCancel, InputType as CancelInput } from "../endpoints/admin/live-lessons/cancel_POST.schema";

export const useAdminCancelLiveLessonMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelInput) => postAdminLiveLessonCancel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "live-lessons"] });
    },
  });
};
