import { useQuery } from "@tanstack/react-query";
import { getTeacherRelationshipManager } from "../endpoints/teacher/relationship-manager_GET.schema";

export const TEACHER_RELATIONSHIP_MANAGER_QUERY_KEY = ["teacher", "relationship-manager"];

export const useTeacherRelationshipManager = (enabled: boolean) => {
  return useQuery({
    queryKey: TEACHER_RELATIONSHIP_MANAGER_QUERY_KEY,
    queryFn: () => getTeacherRelationshipManager(),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
};
