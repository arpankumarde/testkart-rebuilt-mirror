import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdminOrganizationsList, type InputType as ListInput } from "../endpoints/admin/organizations/list_GET.schema";
import { getAdminOrganization } from "../endpoints/admin/organizations/get_GET.schema";
import { postAdminSetOrganizationActive } from "../endpoints/admin/organizations/set-active_POST.schema";

export const ADMIN_ORGANIZATIONS_QUERY_KEY = "admin-organizations";
export const ADMIN_ORGANIZATION_QUERY_KEY = "admin-organization";

export const useAdminOrganizationsQuery = (params: ListInput) =>
  useQuery({
    queryKey: [ADMIN_ORGANIZATIONS_QUERY_KEY, params],
    queryFn: () => getAdminOrganizationsList({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

export const useAdminOrganizationQuery = (id: number | null) =>
  useQuery({
    queryKey: [ADMIN_ORGANIZATION_QUERY_KEY, id],
    queryFn: () => getAdminOrganization({ id: id as number }),
    enabled: id !== null,
    retry: (failureCount, error) => !/not found|404/i.test(error.message) && failureCount < 2,
    staleTime: 60 * 1000,
  });

export const useSetOrganizationActiveMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminSetOrganizationActive,
    onSuccess: (result) => {
      toast.success(result.isActive ? "Organisation is visible on the site again." : "Organisation is hidden from the site.");
      queryClient.invalidateQueries({ queryKey: [ADMIN_ORGANIZATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_ORGANIZATION_QUERY_KEY, result.organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organizationProfile"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not update the organisation.");
    },
  });
};