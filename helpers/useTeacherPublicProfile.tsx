import { useQuery } from "@tanstack/react-query";
import { getTeachersProfile } from "../endpoints/teachers/profile_GET.schema";

export const useTeacherPublicProfileQuery = (teacherSlug: string) => {
  return useQuery({
    queryKey: ["teacherProfile", teacherSlug],
    queryFn: () => getTeachersProfile({ teacherSlug }),
    enabled: !!teacherSlug,
    retry: (failureCount, error) => {
      // Don't retry on 404 (Not Found) errors
      if (error.message.includes("Not Found") || error.message.includes("404")) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 10 * 60 * 1000,
  });
};