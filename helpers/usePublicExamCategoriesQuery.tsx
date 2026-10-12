import { useQuery } from "@tanstack/react-query";
import { getExamDirectory } from "../endpoints/exams/directory_GET.schema";

// Same key as the /exams page, so the two share one cached directory.
export const usePublicExamCategoriesQuery = () => {
  return useQuery({
    queryKey: ["public-exam-directory"],
    queryFn: () => getExamDirectory(),
    staleTime: 10 * 60 * 1000, // 10 minutes - this data doesn't change often
  });
};