import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  getAdminContactSubmissions,
  InputType as ListSubmissionsInput,
} from "../endpoints/admin/contact-submissions/list_GET.schema";
import {
  postAdminUpdateContactSubmissionStatus,
  InputType as UpdateStatusInput,
} from "../endpoints/admin/contact-submissions/update-status_POST.schema";

export const ADMIN_CONTACT_SUBMISSIONS_QUERY_KEY_PREFIX = "adminContactSubmissions" as const;

/**
 * A React Query hook to fetch a paginated and filtered list of contact submissions
 * for the admin panel.
 *
 * @param params An object containing optional filters like status, limit, and offset.
 * @returns The result of the `useQuery` hook.
 */
export const useAdminContactSubmissionsQuery = (params: ListSubmissionsInput) => {
  return useQuery({
    queryKey: [ADMIN_CONTACT_SUBMISSIONS_QUERY_KEY_PREFIX, params],
    queryFn: () => getAdminContactSubmissions(params),
  });
};

/**
 * A React Query mutation hook for updating the status of a contact submission.
 *
 * On success, it displays a success toast and invalidates all contact submission
 * queries to ensure the admin UI reflects the change.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useUpdateContactSubmissionStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateStatusInput) => postAdminUpdateContactSubmissionStatus(data),
    onSuccess: (_, variables) => {
      toast.success(`Submission status updated to "${variables.status}".`);
      queryClient.invalidateQueries({
        queryKey: [ADMIN_CONTACT_SUBMISSIONS_QUERY_KEY_PREFIX],
      });
    },
    onError: (error) => {
      console.error("Failed to update submission status:", error);
      toast.error(
        parseErrorMessage(error) ||  "An unknown error occurred."
      );
    },
  });
};