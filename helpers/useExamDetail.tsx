import { useQuery } from "@tanstack/react-query";
import { getPublicExamCategories } from "../endpoints/exams/list_GET.schema";

export type ExamDetail = {
  id: number;
  examName: string;
  fullName: string | null;
  examSlug: string;
  description: string | null;
  categoryName: string;
};

// Shared "resolve an exam slug into its full public detail" query, used by
// the exam hub page and every dedicated per-exam product page (mock tests,
// courses, study notes, bundles). Scans the public categories payload once
// per exam slug — same approach the hub page always used, just factored out
// so it isn't reimplemented per page.
export const useExamDetailQuery = (examSlug: string | undefined) => {
  return useQuery({
    queryKey: ["exam-detail", examSlug],
    queryFn: async (): Promise<ExamDetail | null> => {
      if (!examSlug) return null;
      const data = await getPublicExamCategories();

      for (const category of data.categories) {
        const exam = category.exams.find((e) => e.examSlug === examSlug);
        if (exam) {
          return {
            id: exam.id,
            examName: exam.examName,
            fullName: exam.fullName,
            examSlug: exam.examSlug,
            description: exam.description,
            categoryName: category.categoryName,
          };
        }
      }
      return null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!examSlug,
  });
};
