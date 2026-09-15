import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { announceSessionChange } from "./sessionSync";
import { postAdminImpersonate } from "../endpoints/admin/impersonate_POST.schema";
import { postAdminStopImpersonating } from "../endpoints/admin/stopImpersonating_POST.schema";

/**
 * Provides a mutation hook to start impersonating a user.
 * On success, it tells other open tabs the session changed and navigates to the root.
 * This should only be used in the admin panel.
 */
export const useImpersonateMutation = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      return postAdminImpersonate({ userId });
    },
    onSuccess: async () => {
      announceSessionChange();
      toast.success("Impersonation started successfully. Redirecting...");
      await queryClient.invalidateQueries();
      navigate('/');
    },
    onError: (error) => {
      console.error("Impersonation failed:", error);
      const errorMessage = parseErrorMessage(error) ||  "An unknown error occurred during impersonation.";
      toast.error(`Impersonation failed: ${errorMessage}`);
    },
  });
};

/**
 * Provides a mutation hook to stop impersonating a user.
 * On success, it tells other open tabs the user session ended and navigates to the admin dashboard.
 * This should be used when an admin is currently impersonating a user.
 */
export const useStopImpersonatingMutation = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return postAdminStopImpersonating();
    },
    onSuccess: async () => {
      announceSessionChange();
      toast.success("Stopped impersonating. Redirecting to admin dashboard...");
      await queryClient.invalidateQueries();
      navigate('/admin/dashboard');
    },
    onError: (error) => {
      console.error("Failed to stop impersonation:", error);
      const errorMessage = parseErrorMessage(error) ||  "An unknown error occurred.";
      toast.error(`Failed to stop impersonation: ${errorMessage}`);
    },
  });
};
