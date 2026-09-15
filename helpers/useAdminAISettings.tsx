import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAiProvider } from "../endpoints/admin/settings/ai-provider_GET.schema";
import {
  postUpdateAdminAiProvider,
  InputType as UpdateAIProviderInput,
} from "../endpoints/admin/settings/ai-provider_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_AI_SETTINGS_QUERY_KEY = ["admin", "settings", "ai"] as const;

/**
 * Fetches the platform-wide AI provider setting.
 */
export const useAdminAISettingsQuery = () => {
  return useQuery({
    queryKey: ADMIN_AI_SETTINGS_QUERY_KEY,
    queryFn: getAdminAiProvider,
  });
};

/**
 * Provides a mutation function to update the platform-wide AI provider setting.
 * Invalidates the settings query on success to refetch the latest data.
 */
export const useUpdateAIProviderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateAIProviderInput) =>
      postUpdateAdminAiProvider(data),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ADMIN_AI_SETTINGS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to update AI provider."
      );
    },
  });
};