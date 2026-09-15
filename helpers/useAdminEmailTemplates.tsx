import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminEmailTemplatesList } from "../endpoints/admin/email-templates/list_GET.schema";
import {
  postAdminUpdateEmailTemplate,
  type InputType as UpdateTemplateInput,
} from "../endpoints/admin/email-templates/update_POST.schema";
import {
  postAdminSendTestEmail,
  type InputType as SendTestEmailInput,
} from "../endpoints/admin/email-templates/send-test_POST.schema";

export const ADMIN_EMAIL_TEMPLATES_QUERY_KEY = ["admin", "email-templates"];

/**
 * Hook to fetch all email templates.
 */
export const useAdminEmailTemplatesQuery = () => {
  return useQuery({
    queryKey: ADMIN_EMAIL_TEMPLATES_QUERY_KEY,
    queryFn: () => getAdminEmailTemplatesList(),
  });
};

/**
 * Hook to update an email template.
 */
export const useUpdateEmailTemplateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTemplateInput) => postAdminUpdateEmailTemplate(data),
    onSuccess: () => {
      toast.success("Email template updated successfully.");
      return queryClient.invalidateQueries({
        queryKey: ADMIN_EMAIL_TEMPLATES_QUERY_KEY,
      });
    },
    onError: (error) => {
      console.error("Error updating email template:", error);
      toast.error(
        parseErrorMessage(error) ||  "Failed to update email template."
      );
    },
  });
};

/**
 * Hook to send a test email.
 */
export const useSendTestEmailMutation = () => {
  return useMutation({
    mutationFn: (data: SendTestEmailInput) => postAdminSendTestEmail(data),
    onSuccess: (data) => {
      toast.success(data.message || "Test email sent successfully.");
    },
    onError: (error) => {
      console.error("Error sending test email:", error);
      toast.error(
        parseErrorMessage(error) ||  "Failed to send test email."
      );
    },
  });
};