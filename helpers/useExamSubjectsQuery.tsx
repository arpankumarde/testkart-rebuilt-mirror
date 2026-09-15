import { useQuery } from "@tanstack/react-query";
import { getTeacherExamSubjectsByExam } from "../endpoints/teacher/exam-subjects/by-exam_GET.schema";

export const EXAM_SUBJECTS_QUERY_KEY_PREFIX = "exam-subjects";

/**
 * A React Query hook to fetch all subjects for a specific exam.
 * The query is only enabled when an examId is provided.
 *
 * @param examId The ID of the exam to fetch subjects for. Can be null.
 * @returns The result of the useQuery hook.
 */
export const useExamSubjectsQuery = (examId: number | null) => {
  return useQuery({
    queryKey: [EXAM_SUBJECTS_QUERY_KEY_PREFIX, examId],
    queryFn: () => getTeacherExamSubjectsByExam({ examId: examId! }),
    enabled: examId !== null,
    staleTime: 30 * 60 * 1000,
  });
};

