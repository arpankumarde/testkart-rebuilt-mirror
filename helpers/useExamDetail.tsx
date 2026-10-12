import { useQuery } from "@tanstack/react-query";
import { getExamBySlug, type ExamDetail } from "../endpoints/exams/by-slug_GET.schema";

export type { ExamDetail };

// Shared "resolve an exam slug into its public detail" query, used by the exam
// hub page and every per-exam product page (mock tests, courses, study notes,
// bundles). The pages' SSR prefetches fill the same key from
// fetchExamBySlugServer, so client navigation is the only time this fetches.
export const useExamDetailQuery = (examSlug: string | undefined) => {
  return useQuery({
    queryKey: ["exam-detail", examSlug],
    queryFn: async (): Promise<ExamDetail | null> => {
      if (!examSlug) return null;
      const data = await getExamBySlug({ examSlug });
      return data.exam;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!examSlug,
  });
};