import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherSessions } from "../endpoints/teacher/sessions_GET.schema";
import { postTeacherSessionsSignOutOthers } from "../endpoints/teacher/sessions/sign-out-others_POST.schema";

const TEACHER_SIGN_INS_QUERY_KEY = ["teacher", "sign-ins"] as const;

/** Refetches on mount, overriding the app-wide default, so Settings never shows a stale count. */
export const useTeacherSignIns = () =>
  useQuery({
    queryKey: TEACHER_SIGN_INS_QUERY_KEY,
    queryFn: () => getTeacherSessions(),
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

export const useSignOutOtherDevices = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postTeacherSessionsSignOutOthers(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TEACHER_SIGN_INS_QUERY_KEY }),
  });
};