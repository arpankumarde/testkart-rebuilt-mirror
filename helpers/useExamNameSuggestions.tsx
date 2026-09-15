import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getCustomExamNames } from "../endpoints/exams/custom-names_GET.schema";
import { usePublicExamCategoriesQuery } from "./usePublicExamCategoriesQuery";

export const CUSTOM_EXAM_NAMES_QUERY_KEY = ["exams", "custom-names"];

export const useCustomExamNamesQuery = () => {
  return useQuery({
    queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY,
    queryFn: () => getCustomExamNames(),
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });
};

export const useExamNameSuggestions = () => {
  const { data: categoriesData, isLoading: isCategoriesLoading } =
    usePublicExamCategoriesQuery();
  
  const { data: customNamesData, isLoading: isCustomNamesLoading } =
    useCustomExamNamesQuery();

  const officialExams = useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.categories.flatMap((cat) =>
      cat.exams.map((exam) => ({
        name: exam.examName,
        fullName: exam.fullName,
      }))
    );
  }, [categoriesData]);

  const communityNames = useMemo(() => {
    if (!customNamesData) return [];
    const officialSet = new Set(officialExams.map((e) => e.name.toLowerCase()));
    
    // Deduplicate against official exams (case-insensitive)
    return customNamesData.names.filter(
      (name) => !officialSet.has(name.toLowerCase())
    );
  }, [customNamesData, officialExams]);

  return {
    officialExams,
    communityNames,
    isLoading: isCategoriesLoading || isCustomNamesLoading,
  };
};