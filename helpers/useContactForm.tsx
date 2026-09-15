import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  postContactSubmit,
  InputType as ContactFormInput,
} from "../endpoints/contact/submit_POST.schema";
import { ADMIN_CONTACT_SUBMISSIONS_QUERY_KEY_PREFIX } from "./useAdminContactSubmissions";

/**
 * A React Query mutation hook for submitting the public contact form.
 *
 * This hook calls the `/_api/contact/submit` endpoint. On success, it
 * displays a success toast and invalidates the admin-side submissions query
 * to ensure the admin panel reflects the new entry.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useContactFormMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ContactFormInput) => postContactSubmit(data),
    onSuccess: () => {
      toast.success("Your message has been sent successfully! We will get back to you shortly.");
      // Invalidate the admin query for contact submissions so the list is updated.
      queryClient.invalidateQueries({
        queryKey: [ADMIN_CONTACT_SUBMISSIONS_QUERY_KEY_PREFIX],
      });
    },
    onError: (error) => {
      console.error("Failed to submit contact form:", error);
      toast.error(
        parseErrorMessage(error) ||  "An unknown error occurred while sending your message."
      );
    },
  });
};