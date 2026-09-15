import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminSupportThreads, InputType as AdminThreadsInput } from "../endpoints/admin/support/threads_GET.schema";
import { getAdminSupportThreadMessages } from "../endpoints/admin/support/thread/messages_GET.schema";
import { postAdminSupportThreadReply } from "../endpoints/admin/support/thread/reply_POST.schema";
import { postAdminSupportThreadStatus } from "../endpoints/admin/support/thread/status_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_SUPPORT_THREADS_KEY = ["admin", "support", "threads"];
export const ADMIN_SUPPORT_MESSAGES_KEY = (threadId: number) => ["admin", "support", "messages", threadId];

export function useAdminThreadsQuery(
  page: number = 1, 
  limit: number = 20, 
  status?: AdminThreadsInput['status'], 
  search?: string,
  unread: boolean = false
) {
  return useQuery({
    queryKey: [...ADMIN_SUPPORT_THREADS_KEY, page, limit, status, search, unread],
    queryFn: () => getAdminSupportThreads({ page, limit, status, search, unread }),
  });
}

export function useAdminThreadMessagesQuery(threadId: number | undefined) {
  return useQuery({
    queryKey: ADMIN_SUPPORT_MESSAGES_KEY(threadId!),
    queryFn: () => getAdminSupportThreadMessages({ threadId: threadId! }),
    enabled: !!threadId,
  });
}

export function useAdminReplyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminSupportThreadReply,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_THREADS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_MESSAGES_KEY(variables.threadId) });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) ||  "Failed to send reply");
    }
  });
}

export function useUpdateThreadStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminSupportThreadStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_THREADS_KEY });
      toast.success("Thread status updated");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) ||  "Failed to update thread status");
    }
  });
}