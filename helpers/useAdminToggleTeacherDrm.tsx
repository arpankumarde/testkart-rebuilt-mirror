import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postAdminToggleTeacherDrm } from "../endpoints/admin/teachers/toggle-drm_POST.schema";
import { ADMIN_TEACHERS_QUERY_KEY } from "./useAdminTeachers";

export const useAdminToggleTeacherDrmMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postAdminToggleTeacherDrm,
    onSuccess: (data) => {
      toast.success(data.drmEnabled ? "DRM turned on." : "DRM turned off.");
      queryClient.invalidateQueries({ queryKey: [ADMIN_TEACHERS_QUERY_KEY] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Could not update DRM.");
    },
  });
};