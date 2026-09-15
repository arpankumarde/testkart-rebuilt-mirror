import { useQuery } from "@tanstack/react-query";
import { getTestsByExamName } from "../endpoints/tests/by-subject_GET.schema";

export const useTestsByExamNameQuery = (examName?: string) => {
  return useQuery({
    queryKey: ["tests", "by-exam", examName],
    queryFn: () => getTestsByExamName({ examName }),
    // The query will only run if the examName is a non-empty string.
    enabled: !!examName,
  });
};