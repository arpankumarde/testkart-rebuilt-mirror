import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTestItemSubjectsList } from "../endpoints/teacher/test-item-subjects/list_GET.schema";
import { postTestItemSubjectsCreate } from "../endpoints/teacher/test-item-subjects/create_POST.schema";
import { postTestItemSubjectsUpdate } from "../endpoints/teacher/test-item-subjects/update_POST.schema";
import { postTestItemSubjectsDelete } from "../endpoints/teacher/test-item-subjects/delete_POST.schema";
import { postTestItemSubjectsBulkCreate } from "../endpoints/teacher/test-item-subjects/bulk-create_POST.schema";
import { postTeacherTestItemSubjectsReorder } from "../endpoints/teacher/test-item-subjects/reorder_POST.schema";
import { TEACHER_TESTS_QUERY_KEY, TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX } from "./useTeacherTestsQuery";

export const getTestItemSubjectsQueryKey = (testItemId: number) => [
  "teacher",
  "test-item-subjects",
  testItemId,
];

export const useTestItemSubjectsQuery = (testItemId: number | null) => {
  return useQuery({
    queryKey: getTestItemSubjectsQueryKey(testItemId!),
    queryFn: () => getTestItemSubjectsList({ testItemId: testItemId! }),
    enabled: testItemId !== null,
    // Each row carries actualQuestionCount, which changes on the *questions*
    // page and is then read back here on the test-items page. refetchOnMount is
    // off globally (and also blocks the "refetch if invalidated" check on
    // remount), so without this override the teacher navigates back to a
    // 30-minute-stale cache still reporting 0 questions.
    refetchOnMount: true,
  });
};

export const useTestItemSubjectsMutations = (testItemId: number) => {
  const queryClient = useQueryClient();

  // Subject changes also move the item card's subject and question counts, its
  // blocking warnings and its subject-wise duration, and the series totals.
  const invalidateSubjectsQuery = () => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: getTestItemSubjectsQueryKey(testItemId) }),
      queryClient.invalidateQueries({ queryKey: [TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX] }),
      queryClient.invalidateQueries({ queryKey: TEACHER_TESTS_QUERY_KEY }),
    ]);
  };

  const useCreateSubjectMutation = () => {
    return useMutation({
      mutationFn: postTestItemSubjectsCreate,
      onSuccess: () => {
        invalidateSubjectsQuery();
      },
    });
  };

  const useUpdateSubjectMutation = () => {
    return useMutation({
      mutationFn: postTestItemSubjectsUpdate,
      onSuccess: () => {
        invalidateSubjectsQuery();
      },
    });
  };

  const useDeleteSubjectMutation = () => {
    return useMutation({
      mutationFn: postTestItemSubjectsDelete,
      onSuccess: () => {
        invalidateSubjectsQuery();
      },
    });
  };

  const useCreateMultipleSubjectsMutation = () => {
    return useMutation({
      mutationFn: postTestItemSubjectsBulkCreate,
      onSuccess: () => {
        invalidateSubjectsQuery();
      },
    });
  };

  const useReorderSubjectsMutation = () => {
    return useMutation({
      mutationFn: postTeacherTestItemSubjectsReorder,
      onSuccess: () => {
        invalidateSubjectsQuery();
      },
    });
  };

  return {
    useCreateSubjectMutation,
    useUpdateSubjectMutation,
    useDeleteSubjectMutation,
    useCreateMultipleSubjectsMutation,
    useReorderSubjectsMutation,
  };
};