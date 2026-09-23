import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postExamFocusSave } from "../endpoints/exam-focus/save_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";
import type { User } from "./User";

type SessionData = { user: User; impersonatorAdminId?: number };

const useUpdateSessionUser = () => {
  const queryClient = useQueryClient();
  return (patch: Partial<User>) =>
    queryClient.setQueryData<SessionData | null>(AUTH_QUERY_KEY, (current) =>
      current ? { ...current, user: { ...current.user, ...patch } } : current
    );
};

export const useSaveExamFocusMutation = () => {
  const updateSessionUser = useUpdateSessionUser();
  return useMutation({
    mutationFn: (examIds: number[]) => postExamFocusSave({ examIds }),
    onSuccess: ({ examFocus }) => {
      updateSessionUser({
        examFocus,
        examFocusPromptDue: false,
        targetExams: examFocus.map((exam) => exam.examName),
      });
    },
  });
};