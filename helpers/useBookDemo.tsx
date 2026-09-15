import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseErrorMessage } from "./parseErrorMessage";
import {
  postDemoRequest,
  InputType as DemoRequestInput,
} from "../endpoints/demo-request/submit_POST.schema";
import { ADMIN_SALES_CONTACTS_QUERY_KEY } from "./useAdminSalesContacts";

/**
 * Submits a "Book a demo" lead from the public site.
 *
 * The endpoint writes straight into the sales pipeline (`sales_contacts` with
 * source = 'demo_request'), so we invalidate the admin pipeline query too — an
 * admin with the sales page open sees the lead without a manual refresh.
 *
 * Unlike most public forms this hook does NOT toast on success: the popup shows
 * its own inline confirmation. Errors are surfaced by the caller.
 */
export const useBookDemoMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DemoRequestInput) => postDemoRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [ADMIN_SALES_CONTACTS_QUERY_KEY],
      });
    },
    onError: (error) => {
      console.error("Failed to submit demo request:", error);
    },
  });
};

export const getBookDemoErrorMessage = (error: unknown): string =>
  parseErrorMessage(error) || "Something went wrong. Please try again.";
