import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherQuestionsBySubject } from "../endpoints/teacher/questions/by-subject_GET.schema";
import { postTeacherQuestionsReorder } from "../endpoints/teacher/questions/reorder_POST.schema";
import { postTeacherQuestionsAssignSections } from "../endpoints/teacher/questions/assign-sections_POST.schema";
import { getSubjectSectionsQueryKey } from "./useSubjectSections";

export const TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX = [
  "teacher",
  "questions",
  "by-subject",
];

export const useTeacherQuestionsBySubjectQuery = (
  subjectId: number | null | undefined
) => {
  return useQuery({
    queryKey: [...TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX, subjectId],
    queryFn: () => getTeacherQuestionsBySubject({ subjectId: subjectId! }),
    enabled: typeof subjectId === "number" && subjectId > 0,
  });
};

export const useReorderQuestionsMutation = (subjectId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postTeacherQuestionsReorder,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX, subjectId],
      });
    },
  });
};

export const useAssignSectionsMutation = (subjectId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postTeacherQuestionsAssignSections,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX, subjectId],
      });
      queryClient.invalidateQueries({
        queryKey: getSubjectSectionsQueryKey(subjectId),
      });
    },
  });
};