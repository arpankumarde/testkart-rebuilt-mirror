import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminProfileSessions } from "../endpoints/admin/profile/sessions_GET.schema";
import {
  postAdminProfileSessionsTerminate,
  InputType as TerminateInput,
} from "../endpoints/admin/profile/sessions/terminate_POST.schema";
import { getAdminAdminsSessions } from "../endpoints/admin/admins/sessions_GET.schema";
import {
  postAdminAdminsSessionsTerminate,
  InputType as TerminateForInput,
} from "../endpoints/admin/admins/sessions/terminate_POST.schema";
import { postAdminAdminsImpersonate } from "../endpoints/admin/admins/impersonate_POST.schema";
import { postAdminProfileStopImpersonating } from "../endpoints/admin/profile/stop-impersonating_POST.schema";

const ADMIN_SESSIONS_QUERY_KEY = ["admin", "profile", "sessions"] as const;
const ADMIN_SESSIONS_FOR_QUERY_KEY = ["admin", "admin-sessions"] as const;

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

/** Another admin's sign-ins, for a super admin. Fetched fresh each time the dialog opens. */
export const useAdminSessionsFor = (adminId: number | null) =>
  useQuery({
    queryKey: [...ADMIN_SESSIONS_FOR_QUERY_KEY, adminId],
    queryFn: () => getAdminAdminsSessions({ adminId: adminId as number }),
    enabled: adminId !== null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

export const useTerminateAdminSessionFor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TerminateForInput) => postAdminAdminsSessionsTerminate(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ADMIN_SESSIONS_FOR_QUERY_KEY }),
  });
};

/**
 * Both swap the browser's admin cookie for a different admin's, so on success the caller reloads
 * the admin panel rather than patching every cached query.
 */
export const useImpersonateAdmin = () =>
  useMutation({ mutationFn: (adminId: number) => postAdminAdminsImpersonate({ adminId }) });

export const useStopImpersonatingAdmin = () =>
  useMutation({ mutationFn: () => postAdminProfileStopImpersonating() });
