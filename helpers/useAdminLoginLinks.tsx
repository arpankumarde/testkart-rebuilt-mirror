import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminLoginLinks } from "../endpoints/admin/user/login-links/list_GET.schema";
import { postAdminLoginLinkCreate } from "../endpoints/admin/user/login-links/create_POST.schema";
import { postAdminLoginLinkRevoke } from "../endpoints/admin/user/login-links/revoke_POST.schema";

export const ADMIN_LOGIN_LINKS_QUERY_KEY = "adminLoginLinks";

export const useAdminLoginLinksQuery = (userId: number | null) =>
  useQuery({
    queryKey: [ADMIN_LOGIN_LINKS_QUERY_KEY, userId],
    queryFn: () => getAdminLoginLinks({ userId: userId! }),
    enabled: userId != null,
    staleTime: 0,
    refetchOnMount: "always",
  });

export const useCreateLoginLinkMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminLoginLinkCreate,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_LOGIN_LINKS_QUERY_KEY, variables.userId] });
    },
    onError: (error) => {
      toast.error(`Could not create the link: ${parseErrorMessage(error)}`);
    },
  });
};

export const useRevokeLoginLinkMutation = (userId: number | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminLoginLinkRevoke,
    onSuccess: () => {
      toast.success("Link cancelled. It no longer signs anyone in.");
      queryClient.invalidateQueries({ queryKey: [ADMIN_LOGIN_LINKS_QUERY_KEY, userId] });
    },
    onError: (error) => {
      toast.error(`Could not cancel the link: ${parseErrorMessage(error)}`);
    },
  });
};