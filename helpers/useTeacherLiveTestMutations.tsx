import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  postTeacherLiveTestsCreate,
  InputType as CreateLiveTestInput,
} from "../endpoints/teacher/live-tests/create_POST.schema";
import {
  postTeacherLiveTestsUpdate,
  InputType as UpdateLiveTestInput,
} from "../endpoints/teacher/live-tests/update_POST.schema";
import {
  postTeacherLiveTestsDelete,
  InputType as DeleteLiveTestInput,
} from "../endpoints/teacher/live-tests/delete_POST.schema";
import {
  postTeacherLiveTestsDuplicate,
  InputType as DuplicateLiveTestInput,
} from "../endpoints/teacher/live-tests/duplicate_POST.schema";
import {
  postTeacherLiveTestsUnpublish,
  InputType as UnpublishLiveTestInput,
} from "../endpoints/teacher/live-tests/unpublish_POST.schema";
import { TEACHER_LIVE_TESTS_QUERY_KEY } from "./useTeacherLiveTestsQuery";
import { LIVE_TESTS_QUERY_KEY } from "./useLiveTestsQuery";
import { TEACHER_DASHBOARD_STATS_QUERY_KEY } from "./useTeacherDashboardStats";
import { getLiveTestDetailsQueryKey } from "./useLiveTestQueries";

// These hooks own the toast for every outcome, so callers must not add their own.
export const useTeacherLiveTestMutations = () => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: TEACHER_LIVE_TESTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: LIVE_TESTS_QUERY_KEY });
    // The teacher dashboard's counts/top-items come from a separate,
    // independently cached endpoint - without this a new/updated/deleted
    // live test never appears there until a manual page refresh.
    queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY });
  };

  // The details query backs the editor form and the question manager header;
  // a stale entry would reseed the editor with pre-save values.
  const invalidateDetails = (liveTestId: number) => {
    queryClient.invalidateQueries({ queryKey: getLiveTestDetailsQueryKey(liveTestId) });
  };

  const useCreateLiveTestMutation = () =>
    useMutation({
      mutationFn: (data: CreateLiveTestInput) => postTeacherLiveTestsCreate(data),
      onSuccess: () => {
        toast.success("Live test created. Add your questions next.");
        invalidateQueries();
      },
      onError: (error) => {
        toast.error(`Failed to create live test: ${parseErrorMessage(error)}`);
        console.error("Create live test error:", error);
      },
    });

  const useUpdateLiveTestMutation = () =>
    useMutation({
      mutationFn: (data: UpdateLiveTestInput) => postTeacherLiveTestsUpdate(data),
      onSuccess: (_data, variables) => {
        toast.success("Changes saved.");
        invalidateDetails(variables.id);
        invalidateQueries();
      },
      onError: (error) => {
        toast.error(`Failed to update live test: ${parseErrorMessage(error)}`);
        console.error("Update live test error:", error);
      },
    });

  const useDeleteLiveTestMutation = () =>
    useMutation({
      mutationFn: (data: DeleteLiveTestInput) => postTeacherLiveTestsDelete(data),
      onSuccess: (_data, variables) => {
        toast.success("Live test deactivated successfully.");
        queryClient.removeQueries({ queryKey: getLiveTestDetailsQueryKey(variables.id) });
        invalidateQueries();
      },
      onError: (error) => {
        toast.error(`Failed to deactivate live test: ${parseErrorMessage(error)}`);
        console.error("Delete live test error:", error);
      },
    });

  const useDuplicateLiveTestMutation = () =>
    useMutation({
      mutationFn: (data: DuplicateLiveTestInput) => postTeacherLiveTestsDuplicate(data),
      onSuccess: () => {
        toast.success("Live test duplicated successfully!");
        invalidateQueries();
      },
      onError: (error) => {
        const errorMessage = parseErrorMessage(error);
        toast.error(`Could not duplicate live test: ${errorMessage}`);
        console.error("Duplicate live test error:", error);
      },
    });

  const useUnpublishLiveTestMutation = () =>
    useMutation({
      mutationFn: (data: UnpublishLiveTestInput) => postTeacherLiveTestsUnpublish(data),
      onSuccess: (_data, variables) => {
        toast.success("Live test unpublished successfully.");
        invalidateDetails(variables.id);
        invalidateQueries();
      },
      onError: (error) => {
        toast.error(`Failed to unpublish live test: ${parseErrorMessage(error)}`);
        console.error("Unpublish live test error:", error);
      },
    });

  return {
    useCreateLiveTestMutation,
    useUpdateLiveTestMutation,
    useDeleteLiveTestMutation,
    useDuplicateLiveTestMutation,
    useUnpublishLiveTestMutation,
  };
};
