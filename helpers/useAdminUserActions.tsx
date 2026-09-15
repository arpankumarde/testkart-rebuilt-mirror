import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postAdminToggleUserStatus } from "../endpoints/admin/user/toggle-status_POST.schema";
import { ADMIN_TEACHERS_QUERY_KEY } from "./useAdminTeachers";
import { ADMIN_STUDENTS_QUERY_KEY } from "./useAdminStudents";

export const useToggleUserStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postAdminToggleUserStatus,
    onSuccess: (data) => {
      toast.success(
        `User status successfully updated to ${data.isActive ? "Active" : "Inactive"}.`
      );
      queryClient.invalidateQueries({ queryKey: [ADMIN_TEACHERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_STUDENTS_QUERY_KEY] });
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(`Failed to update user status: ${parseErrorMessage(error)}`);
      } else {
        toast.error("An unknown error occurred while updating user status.");
      }
    },
  });
};