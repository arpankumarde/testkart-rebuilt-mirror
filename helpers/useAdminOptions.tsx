import { useQuery } from "@tanstack/react-query";
import { getAdminOptions } from "../endpoints/admin/admins/options_GET.schema";

export const ADMIN_OPTIONS_QUERY_KEY = ["admin", "admins", "options"];

export const useAdminOptionsQuery = () => {
  return useQuery({
    queryKey: ADMIN_OPTIONS_QUERY_KEY,
    queryFn: () => getAdminOptions(),
    // Admin management invalidates ["admin", "admins"]; refetching on the next
    // mount lets a new or deactivated admin reach the pickers without a reload.
    refetchOnMount: true,
  });
};