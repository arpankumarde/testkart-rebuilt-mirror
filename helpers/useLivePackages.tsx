import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMentorshipPackages } from "../endpoints/mentorship/packages/list_GET.schema";
import { postMentorshipPackageCheckout } from "../endpoints/mentorship/packages/checkout_POST.schema";
import { postMentorshipPackageVerify } from "../endpoints/mentorship/packages/verify_POST.schema";
import { postMentorshipPackageUpdate } from "../endpoints/mentorship/packages/update_POST.schema";
import { postMentorshipPackageCancel } from "../endpoints/mentorship/packages/cancel_POST.schema";
import { postMentorshipPackagePayNow } from "../endpoints/mentorship/packages/pay-now_POST.schema";
import { postMentorshipCreditSchedule } from "../endpoints/mentorship/credits/schedule_POST.schema";
import { postMentorshipCreditScheduleMany } from "../endpoints/mentorship/credits/schedule-many_POST.schema";
import { postMentorshipCreditRelease } from "../endpoints/mentorship/credits/release_POST.schema";
import { postMentorshipBookingReport } from "../endpoints/mentorship/bookings/report_POST.schema";
import { getTeacherMentorshipPackages } from "../endpoints/teacher/mentorship/packages_GET.schema";
import { getAdminLiveLessonIssues, InputType as IssuesInput } from "../endpoints/admin/live-lessons/issues_GET.schema";
import { postAdminResolveLiveIssue } from "../endpoints/admin/live-lessons/resolve-issue_POST.schema";
import { MENTORSHIP_BOOKINGS_QUERY_KEY } from "./useMentorship";
import { gatePurchase, usePurchaseDetailsGate } from "./usePurchaseDetailsGate";

export const LIVE_PACKAGES_QUERY_KEY = ["mentorship", "packages"] as const;

/** Everything a package action can change: packages, bookings, slots and each tutor's offerings. */
const useInvalidateLive = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: LIVE_PACKAGES_QUERY_KEY, refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: MENTORSHIP_BOOKINGS_QUERY_KEY, refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["mentorship", "slots"], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["mentorship", "teacher-offerings"], refetchType: "all" }),
    ]);
};

export const useLivePackagesQuery = (enabled = true) =>
  useQuery({
    queryKey: LIVE_PACKAGES_QUERY_KEY,
    queryFn: () => getMentorshipPackages(),
    enabled,
    refetchOnMount: true,
    staleTime: 30_000,
  });

export const usePackageCheckoutMutation = () => {
  const ensurePurchaseDetails = usePurchaseDetailsGate();
  return useMutation({ mutationFn: gatePurchase(ensurePurchaseDetails, postMentorshipPackageCheckout) });
};
export const usePackageVerifyMutation = () => useMutation({ mutationFn: postMentorshipPackageVerify });
export const usePackagePayNowMutation = () => useMutation({ mutationFn: postMentorshipPackagePayNow });

export const usePackageUpdateMutation = () => {
  const invalidate = useInvalidateLive();
  return useMutation({ mutationFn: postMentorshipPackageUpdate, onSuccess: invalidate });
};

export const usePackageCancelMutation = () => {
  const invalidate = useInvalidateLive();
  return useMutation({ mutationFn: postMentorshipPackageCancel, onSuccess: invalidate });
};

export const useCreditScheduleMutation = () => {
  const invalidate = useInvalidateLive();
  return useMutation({ mutationFn: postMentorshipCreditSchedule, onSuccess: invalidate });
};

export const useCreditReleaseMutation = () => {
  const invalidate = useInvalidateLive();
  return useMutation({ mutationFn: postMentorshipCreditRelease, onSuccess: invalidate });
};

export const useCreditScheduleManyMutation = () => {
  const invalidate = useInvalidateLive();
  return useMutation({ mutationFn: postMentorshipCreditScheduleMany, onSuccess: invalidate });
};

export const useBookingReportMutation = () => {
  const invalidate = useInvalidateLive();
  return useMutation({ mutationFn: postMentorshipBookingReport, onSuccess: invalidate });
};

export const useInvalidateLiveClasses = useInvalidateLive;

export const useTeacherLivePackagesQuery = () =>
  useQuery({
    queryKey: ["teacher", "mentorship", "packages"],
    queryFn: () => getTeacherMentorshipPackages(),
    refetchOnMount: true,
  });

export const useAdminLiveIssuesQuery = (input: IssuesInput) =>
  useQuery({
    queryKey: ["admin", "live-lessons", "issues", input.status ?? "open"],
    queryFn: () => getAdminLiveLessonIssues(input),
    refetchOnMount: true,
  });

export const useAdminResolveLiveIssueMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminResolveLiveIssue,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "live-lessons", "issues"], refetchType: "all" }),
  });
};
