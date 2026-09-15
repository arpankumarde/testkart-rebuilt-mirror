import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postStartTrial } from "../endpoints/admin/subscriptions/start-trial_POST.schema";
import { postEndTrial } from "../endpoints/admin/subscriptions/end-trial_POST.schema";
import { getSearchTeachers } from "../endpoints/admin/subscriptions/search-teachers_GET.schema";
import { getActiveAdminTrials } from "../endpoints/admin/subscriptions/active-trials_GET.schema";
import { getAdminTrialHistory } from "../endpoints/admin/subscriptions/trial-history_GET.schema";

export const useAdminStartTrial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postStartTrial,
    onSuccess: () => {
      // Invalidate subscription lists to instantly refresh UI
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions", "trial-history"] });
    },
  });
};

export const useAdminEndTrial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postEndTrial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions", "active-trials"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions", "trial-history"] });
    },
  });
};

export const useAdminActiveTrials = () => {
  return useQuery({
    queryKey: ["admin", "subscriptions", "active-trials"],
    queryFn: () => getActiveAdminTrials(),
    staleTime: 120000, // 2 minutes
  });
};

export const useAdminTrialHistory = () => {
  return useQuery({
    queryKey: ["admin", "subscriptions", "trial-history"],
    queryFn: () => getAdminTrialHistory(),
    staleTime: 120000, // 2 minutes
  });
};

export const useAdminSearchTeachers = (q: string) => {
  return useQuery({
    queryKey: ["admin", "teachers", "search", q],
    queryFn: () => getSearchTeachers({ q }),
    enabled: q.length >= 2,
  });
};