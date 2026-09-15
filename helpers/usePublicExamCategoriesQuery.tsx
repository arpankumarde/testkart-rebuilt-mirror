import { useQuery } from "@tanstack/react-query";
import { getPublicExamCategories } from "../endpoints/exams/list_GET.schema";

export const usePublicExamCategoriesQuery = () => {
  return useQuery({
    queryKey: ["exams", "categories"],
    queryFn: () => getPublicExamCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes - this data doesn't change often
  });
};