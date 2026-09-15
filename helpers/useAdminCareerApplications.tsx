import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCareerApplications, CareerApplicationOutput } from "../endpoints/admin/careers/applications_GET.schema";
import { postDeleteCareerApplication } from "../endpoints/admin/careers/delete-application_POST.schema";

export const CAREER_APPLICATIONS_QUERY_KEY = ["admin", "careers", "applications"] as const;

export function useAdminCareerApplications() {
  return useQuery({
    queryKey: CAREER_APPLICATIONS_QUERY_KEY,
    queryFn: async () => {
      const result = await getCareerApplications();
      return result.applications;
    },
  });
}

export function useDeleteAdminCareerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => postDeleteCareerApplication({ id }),
    onSuccess: (_, deletedId) => {
      // Optimistically update the query cache
      queryClient.setQueryData<CareerApplicationOutput[]>(
        CAREER_APPLICATIONS_QUERY_KEY,
        (old) => (old ? old.filter((app) => app.id !== deletedId) : old)
      );
    },
  });
}