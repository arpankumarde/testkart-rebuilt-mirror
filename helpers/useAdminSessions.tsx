import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminProfileSessions } from "../endpoints/admin/profile/sessions_GET.schema";
import {
  postAdminProfileSessionsTerminate,
  InputType as TerminateInput,
} from "../endpoints/admin/profile/sessions/terminate_POST.schema";

const ADMIN_SESSIONS_QUERY_KEY = ["admin", "profile", "sessions"] as const;

/** Refetches on mount, overriding the app-wide default, so Profile never shows a stale list. */
export const useAdminSessions = () =>
  useQuery({
    queryKey: ADMIN_SESSIONS_QUERY_KEY,
    queryFn: () => getAdminProfileSessions(),
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

export const useTerminateAdminSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TerminateInput) => postAdminProfileSessionsTerminate(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ADMIN_SESSIONS_QUERY_KEY }),
  });
};
