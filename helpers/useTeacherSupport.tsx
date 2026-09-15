import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherSupportThreads } from "../endpoints/teacher/support/threads_GET.schema";
import { postTeacherSupportThreadCreate } from "../endpoints/teacher/support/thread/create_POST.schema";
import { getTeacherSupportThreadMessages } from "../endpoints/teacher/support/thread/messages_GET.schema";
import { postTeacherSupportThreadReply } from "../endpoints/teacher/support/thread/reply_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const TEACHER_SUPPORT_THREADS_KEY = ["teacher", "support", "threads"];
export const TEACHER_SUPPORT_MESSAGES_KEY = (threadId: number) => ["teacher", "support", "messages", threadId];

export function useTeacherThreadsQuery(page: number = 1, limit: number = 20, unreadOnly: boolean = false) {
  return useQuery({
    queryKey: [...TEACHER_SUPPORT_THREADS_KEY, page, limit, unreadOnly],
    queryFn: () => getTeacherSupportThreads({ page, limit, unreadOnly }),
    // refetchOnMount is off app-wide. Without this, the dashboard's unread
    // tile could land on a list cached before the reply arrived.
    refetchOnMount: true,
  });
}

export function useThreadMessagesQuery(threadId: number | undefined) {
  return useQuery({
    queryKey: TEACHER_SUPPORT_MESSAGES_KEY(threadId!),
    queryFn: () => getTeacherSupportThreadMessages({ threadId: threadId! }),
    enabled: !!threadId,
  });
}

export function useCreateThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherSupportThreadCreate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_SUPPORT_THREADS_KEY });
      toast.success("Support thread created successfully");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) ||  "Failed to create thread");
    }
  });
}

export function useReplyToThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherSupportThreadReply,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: TEACHER_SUPPORT_THREADS_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_SUPPORT_MESSAGES_KEY(variables.threadId) });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) ||  "Failed to send reply");
    }
  });
}