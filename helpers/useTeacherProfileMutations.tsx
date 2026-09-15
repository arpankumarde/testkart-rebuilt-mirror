import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postTeacherProfileUpdate,
  InputType as ProfileInput,
} from "../endpoints/teacher/profile/update_POST.schema";
import {
  postTeacherAcademyUpdate,
  InputType as AcademyInput,
} from "../endpoints/teacher/academy/update_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";
import { User } from "./User";

export const useTeacherProfileMutations = () => {
  const queryClient = useQueryClient();

  const useUpdateProfileMutation = () => {
    return useMutation({
      mutationFn: (data: ProfileInput) => postTeacherProfileUpdate(data),
            onSuccess: (updatedUser) => {
        // Merge updated fields with existing user data to preserve fields not returned by the endpoint (e.g. onboardingCompleted)
        queryClient.setQueryData<{ user: User; impersonatorAdminId?: number } | null>(
          AUTH_QUERY_KEY,
          (oldData) => {
            if (oldData) {
              return { ...oldData, user: { ...oldData.user, ...updatedUser } };
            }
            return { user: updatedUser };
          }
        );
      },
    });
  };

  const useUpdateAcademyMutation = () => {
    return useMutation({
      mutationFn: (data: AcademyInput) => postTeacherAcademyUpdate(data),
      onSuccess: (data, variables) => {
        // Invalidate session data to refetch the updated displayName
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      },
    });
  };

  return { useUpdateProfileMutation, useUpdateAcademyMutation };
};