import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postAdminSetTeacherRelationshipManager } from "../endpoints/admin/teachers/set-relationship-manager_POST.schema";
import { ADMIN_TEACHERS_QUERY_KEY } from "./useAdminTeachers";

export const useAdminSetTeacherRelationshipManagerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postAdminSetTeacherRelationshipManager,
    onSuccess: (data) => {
      toast.success(`Relationship manager set to ${data.adminName}.`);
      queryClient.invalidateQueries({ queryKey: [ADMIN_TEACHERS_QUERY_KEY] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Could not change the relationship manager.");
    },
  });
};
