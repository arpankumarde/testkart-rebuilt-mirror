import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  postTeacherTestsCreateWithItems,
  InputType as CreateTestWithItemsInput,
} from "../endpoints/teacher/tests/create-with-items_POST.schema";
import {
  postTeacherTestItemsBulkCreate,
  InputType as BulkCreateTestItemsInput,
} from "../endpoints/teacher/test-items/bulk-create_POST.schema";
import { TEACHER_TESTS_QUERY_KEY, TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX } from "./useTeacherTestsQuery";

export const useTeacherBulkMutations = () => {
  const queryClient = useQueryClient();

  const invalidateTestsList = () => {
    queryClient.invalidateQueries({ queryKey: TEACHER_TESTS_QUERY_KEY });
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

  const useCreateTestWithItemsMutation = () =>
    useMutation({
      mutationFn: (data: CreateTestWithItemsInput) =>
        postTeacherTestsCreateWithItems(data),
      onSuccess: () => {
        invalidateTestsList();
      },
      onError: (error: Error) => {
        toast.error(parseErrorMessage(error) || "Failed to create test package");
      },
    });

  const useBulkCreateTestItemsMutation = () =>
    useMutation({
      mutationFn: (data: BulkCreateTestItemsInput) =>
        postTeacherTestItemsBulkCreate(data),
      onSuccess: (_, variables) => {
        invalidateTestsList();
        invalidateTestItemsList(variables.packageId);
      },
      onError: (error: Error) => {
        toast.error(parseErrorMessage(error) || "Failed to create test items");
      },
    });

  return {
    useCreateTestWithItemsMutation,
    useBulkCreateTestItemsMutation,
  };
};