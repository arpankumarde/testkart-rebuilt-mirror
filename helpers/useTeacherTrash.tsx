import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getTeacherTrashList } from "../endpoints/teacher/trash/list_GET.schema";
import {
  postTeacherTrashRestore,
  InputType as RestoreInput,
} from "../endpoints/teacher/trash/restore_POST.schema";
import {
  postTeacherTrashDelete,
  InputType as DeleteInput,
} from "../endpoints/teacher/trash/delete_POST.schema";
import { TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX } from "./useTeacherTestsQuery";

export const TEACHER_TRASH_QUERY_KEY = ["teacher", "trash"];
// We need to invalidate this when a test is restored so it shows back up in the list
export const TEACHER_TESTS_QUERY_KEY = ["teacher", "tests"];

export const useTeacherTrashQuery = () => {
  return useQuery({
    queryKey: TEACHER_TRASH_QUERY_KEY,
    queryFn: () => getTeacherTrashList(),
  });
};

export const useRestoreFromTrashMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RestoreInput) => postTeacherTrashRestore(data),
    onSuccess: (data) => {
      toast.success(data.message || "Item restored successfully");
      queryClient.invalidateQueries({ queryKey: TEACHER_TRASH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_TESTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX] });
    },
    onError: (error: Error) => {
      toast.error(parseErrorMessage(error) || "Failed to restore item");
    },
  });
};

export const usePermanentDeleteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DeleteInput) => postTeacherTrashDelete(data),
    onSuccess: () => {
      toast.success("Item permanently deleted");
      queryClient.invalidateQueries({ queryKey: TEACHER_TRASH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_TESTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX] });
    },
    onError: (error: Error) => {
      toast.error(parseErrorMessage(error) || "Failed to permanently delete item");
    },
  });
};