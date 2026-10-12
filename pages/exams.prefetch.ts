import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchExamDirectoryServer } from "../helpers/fetchExamDirectoryServer";

export const prefetch: PagePrefetchFn = async ({ qc }) => {
  try {
    // Same key as the useQuery in pages/exams.tsx.
    await qc.fetchQuery({
      queryKey: ["public-exam-directory"],
      queryFn: () => fetchExamDirectoryServer(),
    });
    return { maxAge: 300 };
  } catch (error) {
    console.error("Error prefetching exam directory:", error);
    return { maxAge: 0 };
  }
};
