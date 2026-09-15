import { useQuery } from "@tanstack/react-query";
import { getTeacherLiveTestsList, InputType } from "../endpoints/teacher/live-tests/list_GET.schema";

export const TEACHER_LIVE_TESTS_QUERY_KEY = ["teacherLiveTests"] as const;

export const useTeacherLiveTestsQuery = (filters?: Partial<InputType>) => {
  return useQuery({
    queryKey: [...TEACHER_LIVE_TESTS_QUERY_KEY, filters],
    queryFn: () => getTeacherLiveTestsList(filters),
    staleTime: 15 * 60 * 1000,
    // See the matching comment in useTeacherProductsQuery — refetchOnMount
    // is disabled globally, so without this override an invalidation fired
    // while this list isn't mounted (e.g. teacher is on a different page)
    // never gets picked up until a hard reload.
    refetchOnMount: true,
  });
};