import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminSubscriptionPlans } from "../endpoints/admin/subscription-plans/list_GET.schema";
import { postAdminUpsertSubscriptionPlan, InputType as UpsertPlanInput } from "../endpoints/admin/subscription-plans/upsert_POST.schema";
import { postAdminToggleSubscriptionPlan, InputType as TogglePlanInput } from "../endpoints/admin/subscription-plans/toggle_POST.schema";
import { getAdminSubscriptionSettings } from "../endpoints/admin/settings/subscription_GET.schema";
import { postAdminSubscriptionSettings, InputType as SettingsInput } from "../endpoints/admin/settings/subscription_POST.schema";

export const ADMIN_PLANS_QUERY_KEY = ["admin", "subscriptionPlans"];
export const ADMIN_SETTINGS_SUB_QUERY_KEY = ["admin", "settings", "subscription"];

export function useAdminPlansQuery() {
  return useQuery({
    queryKey: ADMIN_PLANS_QUERY_KEY,
    queryFn: () => getAdminSubscriptionPlans(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpsertPlanInput) => postAdminUpsertSubscriptionPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY });
      toast.success("Subscription plan saved successfully");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
}

export function useTogglePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TogglePlanInput) => postAdminToggleSubscriptionPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PLANS_QUERY_KEY });
      toast.success("Plan status updated");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
}

export function useSubscriptionPaymentModeQuery() {
  return useQuery({
    queryKey: ADMIN_SETTINGS_SUB_QUERY_KEY,
    queryFn: () => getAdminSubscriptionSettings(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdatePaymentModeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SettingsInput) => postAdminSubscriptionSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SETTINGS_SUB_QUERY_KEY });
      toast.success("Payment mode updated successfully");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
}