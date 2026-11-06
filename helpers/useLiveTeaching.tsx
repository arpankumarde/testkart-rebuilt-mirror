import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherLiveTeachingStatus } from "../endpoints/teacher/live-teaching/status_GET.schema";
import {
  postTeacherLiveTeachingVideo,
  InputType as VideoInput,
} from "../endpoints/teacher/live-teaching/video_POST.schema";
import { postTeacherLiveTeachingApply } from "../endpoints/teacher/live-teaching/apply_POST.schema";
import {
  getAdminLiveTeachingApplications,
  InputType as AdminListInput,
} from "../endpoints/admin/teachers/live-teaching/list_GET.schema";
import {
  postAdminLiveTeachingDecide,
  InputType as DecideInput,
} from "../endpoints/admin/teachers/live-teaching/decide_POST.schema";

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
