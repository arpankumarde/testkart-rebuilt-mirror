import { useQuery } from "@tanstack/react-query";
import { getTeachersProfile } from "../endpoints/teachers/profile_GET.schema";
import { isNotFoundError } from "./isNotFoundError";

export const useTeacherPublicProfileQuery = (teacherSlug: string) => {
  return useQuery({
    queryKey: ["teacherProfile", teacherSlug],
    queryFn: () => getTeachersProfile({ teacherSlug }),
    enabled: !!teacherSlug,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
    staleTime: 10 * 60 * 1000,
  });
};