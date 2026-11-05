import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminLiveLessonsList, InputType as ListInput } from "../endpoints/admin/live-lessons/list_GET.schema";
import { postAdminLiveLessonCancel, InputType as CancelInput } from "../endpoints/admin/live-lessons/cancel_POST.schema";

export const adminLiveLessonsKey = (filter: ListInput["filter"]) => ["admin", "live-lessons", "list", filter ?? "upcoming"] as const;

export const useAdminLiveLessonsQuery = (filter: ListInput["filter"]) =>
  useQuery({
    queryKey: adminLiveLessonsKey(filter),
    queryFn: () => getAdminLiveLessonsList({ filter }),
  });

export const useAdminCancelLiveLessonMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelInput) => postAdminLiveLessonCancel(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "live-lessons", "list"] });
    },
  });
};
