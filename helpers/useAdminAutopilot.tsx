import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminAutopilotOverview } from "../endpoints/admin/autopilot/overview_GET.schema";
import { postAdminAutopilotSettings } from "../endpoints/admin/autopilot/settings_POST.schema";
import { postAdminAutopilotAiTest } from "../endpoints/admin/autopilot/ai-test_POST.schema";
import { getAdminAutopilotWhatsAppTemplates } from "../endpoints/admin/autopilot/whatsapp-templates_GET.schema";
import { postAdminAutopilotWhatsAppTemplates } from "../endpoints/admin/autopilot/whatsapp-templates_POST.schema";
import { getAdminAutopilotLedger, type InputType as LedgerParams } from "../endpoints/admin/autopilot/ledger_GET.schema";
import { getAdminAutopilotOperations } from "../endpoints/admin/autopilot/operations_GET.schema";
import { getAdminAutopilotJourney } from "../endpoints/admin/autopilot/journey_GET.schema";

export const AUTOPILOT_QUERY_KEY = "adminAutopilot";

export const useAutopilotOverview = (days: 7 | 30 | 90) =>
  useQuery({
    queryKey: [AUTOPILOT_QUERY_KEY, "overview", days],
    queryFn: () => getAdminAutopilotOverview({ days }),
    refetchOnMount: true,
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });

export const useAutopilotLedger = (params: LedgerParams, enabled: boolean) =>
  useQuery({
    queryKey: [AUTOPILOT_QUERY_KEY, "ledger", params],
    queryFn: () => getAdminAutopilotLedger(params),
    enabled,
    refetchOnMount: true,
    staleTime: 30 * 1000,
    placeholderData: (previous) => previous,
  });

export const useAutopilotOperations = (enabled: boolean) =>
  useQuery({
    queryKey: [AUTOPILOT_QUERY_KEY, "operations"],
    queryFn: () => getAdminAutopilotOperations(),
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });

export const useAutopilotJourney = (userId: number | null) =>
  useQuery({
    queryKey: [AUTOPILOT_QUERY_KEY, "journey", userId],
    queryFn: () => getAdminAutopilotJourney({ userId: userId! }),
    enabled: userId !== null,
    refetchOnMount: true,
    staleTime: 30 * 1000,
  });

export const useAutopilotSettingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminAutopilotSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [AUTOPILOT_QUERY_KEY] }),
  });
};

export const useAutopilotAiTestMutation = () =>
  useMutation({
    mutationFn: () => postAdminAutopilotAiTest({}),
  });

export const useAutopilotWhatsAppTemplates = () =>
  useQuery({
    queryKey: [AUTOPILOT_QUERY_KEY, "whatsapp-templates"],
    queryFn: () => getAdminAutopilotWhatsAppTemplates(),
    refetchOnMount: true,
    staleTime: 5 * 60 * 1000,
  });

export const useCreateAutopilotWhatsAppTemplates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postAdminAutopilotWhatsAppTemplates(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [AUTOPILOT_QUERY_KEY, "whatsapp-templates"] }),
  });
};