import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postAdminToggleUserVerifiedStatus } from "../endpoints/admin/user/toggle-verified_POST.schema";
import { ADMIN_TEACHERS_QUERY_KEY } from "./useAdminTeachers";

export const useAdminToggleVerifiedMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postAdminToggleUserVerifiedStatus,
    onSuccess: (data) => {
      // Show success toast
      toast.success(
        `User verification status updated to ${data.isVerified ? "Verified" : "Unverified"}.`
      );

      // Invalidate relevant queries to ensure the UI updates
      // This covers multiple possible endpoints where the user data might be cached
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_TEACHERS_QUERY_KEY] });
    },
    onError: (error) => {
      // Show error toast
      toast.error(
        parseErrorMessage(error) ||  "Failed to update verification status."
      );
    },
  });
};