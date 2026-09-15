import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminScripts } from "../endpoints/admin/scripts/get_GET.schema";
import {
  postUpdateAdminScripts,
  InputType as UpdateScriptsInput,
} from "../endpoints/admin/scripts/update_POST.schema";

export const ADMIN_SCRIPTS_QUERY_KEY = ["admin", "scripts"] as const;

/**
 * Fetches the platform-wide header and footer scripts.
 */
export const useAdminScriptsQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ADMIN_SCRIPTS_QUERY_KEY,
    queryFn: getAdminScripts,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - admin scripts rarely change
    enabled: options?.enabled,
  });
};

/**
 * Provides a mutation function to update the platform-wide scripts.
 * Invalidates the scripts query on success to refetch the latest data.
 */
export const useAdminScriptsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateScriptsInput) => postUpdateAdminScripts(data),
    onSuccess: () => {
      // Invalidate and refetch the scripts query to show the updated data
      queryClient.invalidateQueries({ queryKey: ADMIN_SCRIPTS_QUERY_KEY });
    },
  });
};