import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postStudentProfileUpdate,
  InputType as ProfileInput,
  OutputType as ProfileOutput,
} from "../endpoints/student/profile/update_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";

export const useStudentProfileMutations = () => {
  const queryClient = useQueryClient();

  const useUpdateStudentProfileMutation = () => {
    return useMutation({
      mutationFn: (data: ProfileInput) => postStudentProfileUpdate(data),
      onSuccess: (updatedUser) => {
        // Optimistically update the user session data in the cache
        queryClient.setQueryData<{ user: ProfileOutput } | null>(AUTH_QUERY_KEY, (oldData) => {
          if (oldData) {
            return { ...oldData, user: { ...oldData.user, ...updatedUser } };
          }
          // This case should ideally not happen if the user is authenticated
          return { user: updatedUser };
        });
      },
    });
  };

  return { useUpdateStudentProfileMutation };
};