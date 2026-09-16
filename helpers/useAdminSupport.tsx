import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getAdminSupportThreads,
  InputType as AdminThreadsInput,
  OutputType as AdminThreadsOutput,
} from "../endpoints/admin/support/threads_GET.schema";
import {
  getAdminSupportThreadMessages,
  OutputType as AdminThreadMessages,
} from "../endpoints/admin/support/thread/messages_GET.schema";
import {
  postAdminSupportThreadReply,
  InputType as AdminReplyInput,
} from "../endpoints/admin/support/thread/reply_POST.schema";
import { postAdminSupportThreadStatus } from "../endpoints/admin/support/thread/status_POST.schema";
import { ADMIN_OVERVIEW_QUERY_KEY } from "./useAdminDashboardOverview";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_SUPPORT_THREADS_KEY = ["admin", "support", "threads"];
export const ADMIN_SUPPORT_MESSAGES_KEY = (threadId: number) => ["admin", "support", "messages", threadId];

/*
 * The app-wide cache never refetches on mount or focus and holds data for 30
 * minutes, which kept the inbox on whatever it showed when first opened. These
 * queries opt back in, and poll while the tab is visible.
 */
const LIST_POLL_MS = 60_000;
const THREAD_POLL_MS = 30_000;
const LIST_STALE_MS = 15_000;

const STATUS_TOASTS: Record<string, string> = {
  open: "Thread reopened",
  resolved: "Marked resolved",
  closed: "Thread closed",
};

const updateCachedThread = (
  queryClient: QueryClient,
  threadId: number,
  patch: Partial<AdminThreadsOutput["threads"][number]>
) => {
  queryClient.setQueriesData<AdminThreadsOutput>({ queryKey: ADMIN_SUPPORT_THREADS_KEY }, (data) =>
    data?.threads.some((thread) => thread.id === threadId)
      ? { ...data, threads: data.threads.map((thread) => (thread.id === threadId ? { ...thread, ...patch } : thread)) }
      : data
  );
};

const cachedThreadHasUnread = (queryClient: QueryClient, threadId: number) =>
  queryClient
    .getQueriesData<AdminThreadsOutput>({ queryKey: ADMIN_SUPPORT_THREADS_KEY })
    .some(([, data]) => data?.threads.some((thread) => thread.id === threadId && thread.unreadCount > 0));

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
    staleTime: LIST_STALE_MS,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: LIST_POLL_MS,
    // Keeps the rows on screen while another page or filter loads, instead of flashing skeletons.
    placeholderData: (previous) => previous,
  });
}

/* One thread by id, for a thread opened from a link that is not in the list in view. Sits under the list key so list invalidations refresh it. */
export function useAdminThreadQuery(threadId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ADMIN_SUPPORT_THREADS_KEY, "one", threadId],
    queryFn: () => getAdminSupportThreads({ page: 1, limit: 1, threadId: threadId! }),
    select: (data) => data.threads[0] ?? null,
    enabled: enabled && !!threadId,
    staleTime: LIST_STALE_MS,
    refetchOnMount: true,
  });
}

export function useAdminThreadMessagesQuery(threadId: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ADMIN_SUPPORT_MESSAGES_KEY(threadId ?? 0),
    queryFn: async () => {
      const previous = queryClient.getQueryData<AdminThreadMessages>(ADMIN_SUPPORT_MESSAGES_KEY(threadId!));
      const messages = await getAdminSupportThreadMessages({ threadId: threadId! });
      // Loading a thread marks its teacher messages read, so the unread counts in the list and the sidebar move.
      const hadUnread = cachedThreadHasUnread(queryClient, threadId!);
      const gotNewMessages = !!previous && previous[previous.length - 1]?.id !== messages[messages.length - 1]?.id;
      if (hadUnread || gotNewMessages) {
        updateCachedThread(queryClient, threadId!, { unreadCount: 0 });
        void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_THREADS_KEY });
        void queryClient.invalidateQueries({ queryKey: ADMIN_OVERVIEW_QUERY_KEY });
      }
      return messages;
    },
    enabled: !!threadId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: THREAD_POLL_MS,
  });
}

/* senderName fills in the sent message locally until the refetch brings the stored one. */
type AdminReplyVariables = AdminReplyInput & { senderName: string };

export function useAdminReplyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: AdminReplyVariables) =>
      postAdminSupportThreadReply({
        threadId: variables.threadId,
        message: variables.message,
        attachments: variables.attachments,
      }),
    onSuccess: (message, variables) => {
      queryClient.setQueryData<AdminThreadMessages>(ADMIN_SUPPORT_MESSAGES_KEY(variables.threadId), (messages) =>
        messages && !messages.some((existing) => existing.id === message.id)
          ? [...messages, { ...message, senderName: variables.senderName }]
          : messages
      );
      void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_MESSAGES_KEY(variables.threadId) });
      void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_THREADS_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to send reply");
    }
  });
}

export function useUpdateThreadStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminSupportThreadStatus,
    onSuccess: (thread) => {
      updateCachedThread(queryClient, thread.id, { status: thread.status, updatedAt: thread.updatedAt });
      void queryClient.invalidateQueries({ queryKey: ADMIN_SUPPORT_THREADS_KEY });
      void queryClient.invalidateQueries({ queryKey: ADMIN_OVERVIEW_QUERY_KEY });
      toast.success(STATUS_TOASTS[thread.status] ?? "Thread status updated");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update thread status");
    }
  });
}

/* The inbox's Refresh buttons: the list, the open thread and the sidebar counts, together. */
export function useRefreshAdminSupport() {
  const queryClient = useQueryClient();
  return useCallback(
    async (threadId: number | null) => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ADMIN_SUPPORT_THREADS_KEY, type: "active" }),
        threadId ? queryClient.refetchQueries({ queryKey: ADMIN_SUPPORT_MESSAGES_KEY(threadId), type: "active" }) : null,
        queryClient.invalidateQueries({ queryKey: ADMIN_OVERVIEW_QUERY_KEY }),
      ]);
    },
    [queryClient]
  );
}