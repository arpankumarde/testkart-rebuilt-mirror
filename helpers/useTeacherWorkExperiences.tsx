import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWorkExperiences } from "../endpoints/teacher/work-experiences/list_GET.schema";
import { createWorkExperience } from "../endpoints/teacher/work-experiences/create_POST.schema";
import { updateWorkExperience } from "../endpoints/teacher/work-experiences/update_POST.schema";
import { deleteWorkExperience } from "../endpoints/teacher/work-experiences/delete_POST.schema";

export const WORK_EXPERIENCES_QUERY_KEY = ["teacher", "work-experiences"] as const;

export function useWorkExperiencesQuery() {
  return useQuery({
    queryKey: WORK_EXPERIENCES_QUERY_KEY,
    queryFn: () => getWorkExperiences(),
  });
}

export function useCreateWorkExperienceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_EXPERIENCES_QUERY_KEY });
    },
  });
}

export function useUpdateWorkExperienceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWorkExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_EXPERIENCES_QUERY_KEY });
    },
  });
}

export function useDeleteWorkExperienceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_EXPERIENCES_QUERY_KEY });
    },
  });
}