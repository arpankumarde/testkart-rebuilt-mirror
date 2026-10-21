import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postContactSubmit,
  InputType as ContactFormInput,
} from "../endpoints/contact/submit_POST.schema";
import { ADMIN_CONTACT_SUBMISSIONS_QUERY_KEY_PREFIX } from "./useAdminContactSubmissions";

/**
 * A React Query mutation hook for submitting the public contact form.
 *
 * This hook calls the `/_api/contact/submit` endpoint. On success, it
 * invalidates the admin-side submissions query so the admin panel reflects
 * the new entry. The contact page shows the success or failure inline from
 * the mutation state, so there are no toasts here.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useContactFormMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ContactFormInput) => postContactSubmit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [ADMIN_CONTACT_SUBMISSIONS_QUERY_KEY_PREFIX],
      });
    },
    onError: (error) => {
      console.error("Failed to submit contact form:", error);
    },
  });
};
