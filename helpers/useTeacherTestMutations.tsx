import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  postTeacherTestsCreate,
  InputType as CreateTestInput,
} from "../endpoints/teacher/tests/create_POST.schema";
import {
  postTeacherTestsUpdate,
  InputType as UpdateTestInput,
} from "../endpoints/teacher/tests/update_POST.schema";
import {
  postTeacherTestsPublish,
  InputType as PublishTestInput,
} from "../endpoints/teacher/tests/publish_POST.schema";
import {
  postTeacherTestsUnpublish,
  InputType as UnpublishTestInput,
} from "../endpoints/teacher/tests/unpublish_POST.schema";
import {
  postTeacherTestItemsCreate,
  InputType as CreateTestItemInput,
} from "../endpoints/teacher/test-items/create_POST.schema";
import {
  postTeacherTestItemsUpdate,
  InputType as UpdateTestItemInput,
} from "../endpoints/teacher/test-items/update_POST.schema";
import {
  postTeacherTestItemsDelete,
  InputType as DeleteTestItemInput,
} from "../endpoints/teacher/test-items/delete_POST.schema";
import {
  postTeacherQuestionsCreate,
  InputType as CreateQuestionInput,
} from "../endpoints/teacher/questions/create_POST.schema";
import {
  postTeacherQuestionsUpdate,
  InputType as UpdateQuestionInput,
} from "../endpoints/teacher/questions/update_POST.schema";
import {
  postTeacherQuestionsDelete,
  InputType as DeleteQuestionInput,
} from "../endpoints/teacher/questions/delete_POST.schema";
import {
  postTeacherQuestionsGenerateAi,
  InputType as GenerateAiQuestionsInput,
} from "../endpoints/teacher/questions/generate-ai_POST.schema";
import {
  postTeacherQuestionsAcceptAi,
  InputType as AcceptAiQuestionsInput,
} from "../endpoints/teacher/questions/accept-ai_POST.schema";
import { TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX } from "./useTeacherQuestionsBySubject";
import {
  postTeacherTestsDelete,
  InputType as DeleteTestInput,
} from "../endpoints/teacher/tests/delete_POST.schema";
import {
  postTeacherLiveTestsPublish,
  InputType as PublishLiveTestInput,
} from "../endpoints/teacher/live-tests/publish_POST.schema";
import {
  postTeacherTestItemsReorder,
  InputType as ReorderTestItemsInput,
} from "../endpoints/teacher/test-items/reorder_POST.schema";
import {
  TEACHER_TESTS_QUERY_KEY,
  TEACHER_QUESTIONS_QUERY_KEY_PREFIX,
  TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX,
} from "./useTeacherTestsQuery";
 import { TEACHER_LIVE_TESTS_QUERY_KEY } from "./useTeacherLiveTestsQuery";
 import { CUSTOM_EXAM_NAMES_QUERY_KEY } from "./useExamNameSuggestions";
import { TEACHER_TRASH_QUERY_KEY } from "./useTeacherTrash";
import { TEACHER_DASHBOARD_STATS_QUERY_KEY } from "./useTeacherDashboardStats";

export const useTeacherTestMutations = () => {
  const queryClient = useQueryClient();

  // The teacher dashboard ("homepage") shows its own aggregated counts/top
  // items from a single cached endpoint (useTeacherDashboardStats) that is
  // completely separate from the tests list query below — without this, a
  // newly created/published/deleted test never shows up there until the
  // teacher manually refreshes the page.
  const invalidateDashboardStats = () => {
    queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY });
  };

  const invalidateTestsList = () => {
    queryClient.invalidateQueries({ queryKey: TEACHER_TESTS_QUERY_KEY });
    invalidateDashboardStats();
  };

  const invalidateCustomExamNames = () => {
    queryClient.invalidateQueries({ queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY });
  };

  const invalidateTestItemsList = (packageId?: number) => {
    if (packageId) {
      queryClient.invalidateQueries({
        queryKey: [TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX, packageId],
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: [TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX],
      });
    }
  };

  const invalidateQuestionsList = (testItemId: number) => {
    queryClient.invalidateQueries({
      queryKey: [TEACHER_QUESTIONS_QUERY_KEY_PREFIX, testItemId],
    });
  };

  // Every "N Questions" badge a teacher sees while building a test comes from
  // one of these three caches, and the subject-level one (test-item-subjects)
  // is what the test-items screen renders. Miss it and the previous screen
  // keeps reporting 0 questions for the full 30-minute staleTime.
  const invalidateQuestionCounts = () => {
    queryClient.invalidateQueries({
      queryKey: [...TEACHER_QUESTIONS_BY_SUBJECT_QUERY_KEY_PREFIX],
    });
    queryClient.invalidateQueries({
      queryKey: ["teacher", "test-item-subjects"],
    });
    invalidateTestItemsList();
    invalidateTestsList();
  };

  // Test Package Mutations
  const useCreateTestMutation = () =>
    useMutation({
      mutationFn: (data: CreateTestInput) => postTeacherTestsCreate(data),
      onSuccess: () => {
        invalidateTestsList();
        invalidateCustomExamNames();
      },
    });

  const useUpdateTestMutation = () =>
    useMutation({
      mutationFn: (data: UpdateTestInput) => postTeacherTestsUpdate(data),
      onSuccess: () => {
        invalidateTestsList();
        invalidateCustomExamNames();
      },
    });

  const usePublishTestMutation = () =>
    useMutation({
      mutationFn: (data: PublishTestInput) => postTeacherTestsPublish(data),
      onSuccess: (data) => {
        toast.success(data.message);
        invalidateTestsList();
      },
      onError: (error: Error) => {
        toast.error(parseErrorMessage(error) || "Failed to submit test series for review");
      },
    });

  const useUnpublishTestMutation = () =>
    useMutation({
      mutationFn: (data: UnpublishTestInput) => postTeacherTestsUnpublish(data),
      onSuccess: invalidateTestsList,
    });

   const useDeleteTestMutation = () =>
     useMutation({
       mutationFn: (data: DeleteTestInput) => postTeacherTestsDelete(data),
      onSuccess: () => {
        invalidateTestsList();
        queryClient.invalidateQueries({ queryKey: TEACHER_TRASH_QUERY_KEY });
      },
     });

  const usePublishLiveTestMutation = () =>
    useMutation({
      mutationFn: (data: PublishLiveTestInput) =>
        postTeacherLiveTestsPublish(data),
      onSuccess: (data) => {
        toast.success(data.message);
        invalidateTestsList();
        queryClient.invalidateQueries({ queryKey: TEACHER_LIVE_TESTS_QUERY_KEY });
      },
      onError: (error: Error) => {
        toast.error(parseErrorMessage(error) || "Failed to submit live test for review");
      },
    });

  // Test Item Mutations
  const useCreateTestItemMutation = () =>
    useMutation({
      mutationFn: (data: CreateTestItemInput) =>
        postTeacherTestItemsCreate(data),
      onSuccess: (data) => {
        invalidateTestsList();
        invalidateTestItemsList(data.packageId);
      },
    });

  const useUpdateTestItemMutation = () =>
    useMutation({
      mutationFn: (data: UpdateTestItemInput) =>
        postTeacherTestItemsUpdate(data),
      onSuccess: (data) => {
        invalidateTestsList();
        invalidateTestItemsList(data.packageId);
      },
    });

    const useDeleteTestItemMutation = () =>
    useMutation({
      mutationFn: (data: DeleteTestItemInput) =>
        postTeacherTestItemsDelete(data),
      onSuccess: () => {
        invalidateTestsList();
        invalidateTestItemsList();
        queryClient.invalidateQueries({ queryKey: TEACHER_TRASH_QUERY_KEY });
      },
    });

  const useReorderTestItemsMutation = () =>
    useMutation({
      mutationFn: (data: ReorderTestItemsInput) =>
        postTeacherTestItemsReorder(data),
      onSuccess: () => {
        invalidateTestsList();
        invalidateTestItemsList();
      },
    });

  // Question Mutations
    const useCreateQuestionMutation = () =>
    useMutation({
      mutationFn: (data: CreateQuestionInput) => {
        console.log('[useCreateQuestionMutation] Submitting data:', {
          questionTextPreview: data.questionText.substring(0, 200),
          optionAPreview: 'optionA' in data ? data.optionA.substring(0, 100) : 'N/A (numerical question)'
        });
        return postTeacherQuestionsCreate(data);
      },
      onSuccess: (data) => {
        invalidateQuestionsList(data.testId);
        invalidateQuestionCounts();
      },
    });

  const useUpdateQuestionMutation = () =>
    useMutation({
      mutationFn: (data: UpdateQuestionInput) =>
        postTeacherQuestionsUpdate(data),
      onSuccess: (data) => {
        invalidateQuestionsList(data.testId);
        invalidateQuestionCounts();
      },
    });

  const useDeleteQuestionMutation = () =>
    useMutation({
      mutationFn: (data: DeleteQuestionInput) =>
        postTeacherQuestionsDelete(data),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [TEACHER_QUESTIONS_QUERY_KEY_PREFIX],
        });
        invalidateQuestionCounts();
      },
    });

  // Generation alone writes nothing — it returns drafts for the teacher to
  // review — so there is no cache to invalidate until they accept.
  const useGenerateAiQuestionsMutation = () =>
    useMutation({
      mutationFn: (data: GenerateAiQuestionsInput) =>
        postTeacherQuestionsGenerateAi(data),
    });

  const useAcceptAiQuestionsMutation = () =>
    useMutation({
      mutationFn: (data: AcceptAiQuestionsInput) =>
        postTeacherQuestionsAcceptAi(data),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [TEACHER_QUESTIONS_QUERY_KEY_PREFIX],
        });
        invalidateQuestionCounts();
      },
    });

  return {
    useCreateTestMutation,
    useUpdateTestMutation,
    usePublishTestMutation,
    useUnpublishTestMutation,
    useDeleteTestMutation,
    usePublishLiveTestMutation,
    useCreateTestItemMutation,
    useUpdateTestItemMutation,
    useDeleteTestItemMutation,
    useReorderTestItemsMutation,
    useCreateQuestionMutation,
    useUpdateQuestionMutation,
    useDeleteQuestionMutation,
    useGenerateAiQuestionsMutation,
    useAcceptAiQuestionsMutation,
  };
};