import { useQuery } from "@tanstack/react-query";
import { getExamsList } from "../endpoints/teacher/exams/list_GET.schema";

export const EXAMS_LIST_QUERY_KEY = ["exams", "list"];

/**
 * A React Query hook to fetch the complete list of exams.
 * This is useful for populating dropdowns, search fields, or autocomplete components.
 * The data is considered reference data and is cached.
 */
export const useExamsQuery = () => {
  return useQuery({
    queryKey: EXAMS_LIST_QUERY_KEY,
    queryFn: () => getExamsList(),
    staleTime: 30 * 60 * 1000,
  });
};