import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherLiveTeachingStatus } from "../endpoints/teacher/live-teaching/status_GET.schema";
import {
  postTeacherLiveTeachingVideo,
  InputType as VideoInput,
} from "../endpoints/teacher/live-teaching/video_POST.schema";
import { postTeacherLiveTeachingApply } from "../endpoints/teacher/live-teaching/apply_POST.schema";
import {
  postTeacherLiveTeachingContact,
  InputType as ContactInput,
} from "../endpoints/teacher/live-teaching/contact_POST.schema";
import {
  postTeacherLiveTeachingWithdraw,
  InputType as WithdrawInput,
} from "../endpoints/teacher/live-teaching/withdraw_POST.schema";
import {
  getAdminLiveTeachingApplications,
  InputType as AdminListInput,
} from "../endpoints/admin/teachers/live-teaching/list_GET.schema";
import {
  postAdminLiveTeachingDecide,
  InputType as DecideInput,
} from "../endpoints/admin/teachers/live-teaching/decide_POST.schema";
import { AUTH_QUERY_KEY } from "./useAuth";
import type { User } from "./User";

const KEYS = {
  status: ["teacher", "live-teaching", "status"] as const,
  adminList: (status: AdminListInput["status"]) => ["admin", "live-teaching", "applications", status] as const,
};

/* The app turns refetch-on-mount off; status and the queue change outside this tab, so they reload on open. */
export const useLiveTeachingStatusQuery = () =>
  useQuery({
    queryKey: KEYS.status,
    queryFn: () => getTeacherLiveTeachingStatus(),
    refetchOnMount: "always",
  });

/*
 * The same status cache for the sidebar and dashboard, which mount on every
 * page: it reloads on a page change once it is a minute old rather than on each
 * mount, so an approval reaches the sidebar without a request per navigation.
 */
export const useLiveTeachingStatusPeek = (enabled: boolean) =>
  useQuery({
    queryKey: KEYS.status,
    queryFn: () => getTeacherLiveTeachingStatus(),
    enabled,
    staleTime: 60_000,
    refetchOnMount: true,
  });

export const useSaveLiveTeachingVideoMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VideoInput) => postTeacherLiveTeachingVideo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.status }),
  });
};

export const useApplyLiveTeachingMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postTeacherLiveTeachingApply(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.status });
      qc.invalidateQueries({ queryKey: ["teacher", "mentorship", "rate"] });
    },
  });
};

export const useWithdrawLiveTeachingMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WithdrawInput) => postTeacherLiveTeachingWithdraw(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.status }),
  });
};

/* Fills a missing account email or mobile number, and mirrors it into the signed-in user. */
export const useSaveLiveTeachingContactMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ContactInput) => postTeacherLiveTeachingContact(input),
    onSuccess: (saved) => {
      qc.setQueryData<{ user: User; impersonatorAdminId?: number } | null>(AUTH_QUERY_KEY, (old) =>
        old ? { ...old, user: { ...old.user, email: saved.email, mobileNumber: saved.mobileNumber } } : old
      );
      qc.invalidateQueries({ queryKey: KEYS.status });
    },
  });
};

export const useAdminLiveTeachingApplicationsQuery = (status: AdminListInput["status"]) =>
  useQuery({
    queryKey: KEYS.adminList(status),
    queryFn: () => getAdminLiveTeachingApplications({ status }),
    refetchOnMount: "always",
  });

export const useDecideLiveTeachingMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DecideInput) => postAdminLiveTeachingDecide(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "live-teaching", "applications"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
};
