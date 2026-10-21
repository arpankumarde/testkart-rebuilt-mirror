import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminMandates } from "../endpoints/admin/mandates/list_GET.schema";
import { postAdminMandatesRetryCharge } from "../endpoints/admin/mandates/retry-charge_POST.schema";
import { postAdminMandatesRevoke } from "../endpoints/admin/mandates/revoke_POST.schema";
import { postAdminMandatesOverride } from "../endpoints/admin/mandates/override_POST.schema";
import { postAdminMandatesUpdateAdmin } from "../endpoints/admin/mandates/update-admin_POST.schema";

export const ADMIN_MANDATES_QUERY_KEY = ["admin", "mandates"] as const;

export const useAdminMandatesQuery = () =>
  useQuery({
    queryKey: ADMIN_MANDATES_QUERY_KEY,
    queryFn: () => getAdminMandates(),
  });

export const useRetryMandateChargeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminMandatesRetryCharge,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_MANDATES_QUERY_KEY }),
  });
};

export const useRevokeMandateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminMandatesRevoke,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_MANDATES_QUERY_KEY }),
  });
};

export const useOverrideMandateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminMandatesOverride,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_MANDATES_QUERY_KEY }),
  });
};

export const useUpdateMandateAdminMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminMandatesUpdateAdmin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_MANDATES_QUERY_KEY }),
  });
};
