import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminBundlesList } from "../endpoints/admin/bundles/list_GET.schema";
import { postDeactivateBundle } from "../endpoints/admin/bundles/deactivate_POST.schema";

export const ADMIN_BUNDLES_QUERY_KEY = ["admin", "bundles"] as const;

export const useAdminBundlesQuery = () => {
  return useQuery({
    queryKey: ADMIN_BUNDLES_QUERY_KEY,
    queryFn: () => getAdminBundlesList(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useDeactivateBundleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postDeactivateBundle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_BUNDLES_QUERY_KEY });
    },
  });
};