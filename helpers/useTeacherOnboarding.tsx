import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postTeacherOnboardingComplete,
  InputType,
} from "../endpoints/teacher/onboarding/complete_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";
import { User } from "./User";

export const useCompleteOnboardingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InputType) => postTeacherOnboardingComplete(data),
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData<{ user: User; impersonatorAdminId?: number } | null>(
        AUTH_QUERY_KEY,
        (oldData) => {
          if (oldData) {
            return { ...oldData, user: updatedUser };
          }
          return { user: updatedUser };
        }
      );
    },
  });
};