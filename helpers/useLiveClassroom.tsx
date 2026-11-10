import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMentorshipClassroomDetails } from "../endpoints/mentorship/classroom/details_GET.schema";
import { postMentorshipClassroomJoin } from "../endpoints/mentorship/classroom/join_POST.schema";
import { postMentorshipClassroomLeave } from "../endpoints/mentorship/classroom/leave_POST.schema";
import { postMentorshipClassroomChatSend } from "../endpoints/mentorship/classroom/chat/send_POST.schema";
import { getMentorshipClassroomChatList } from "../endpoints/mentorship/classroom/chat/list_GET.schema";
import { getMentorshipClassroomMaterials } from "../endpoints/mentorship/classroom/materials/list_GET.schema";
import { postMentorshipClassroomMaterialAdd } from "../endpoints/mentorship/classroom/materials/add_POST.schema";
import { postMentorshipClassroomMaterialDelete } from "../endpoints/mentorship/classroom/materials/delete_POST.schema";
import { postMentorshipClassroomComplete } from "../endpoints/mentorship/classroom/complete_POST.schema";
import { postMentorshipReview } from "../endpoints/mentorship/review_POST.schema";
import { getTeacherMentorshipNotes } from "../endpoints/teacher/mentorship/notes/list_GET.schema";
import { postTeacherMentorshipNoteUpsert } from "../endpoints/teacher/mentorship/notes/upsert_POST.schema";

export type ClassroomKind = "booking" | "group";

export const useClassroomDetailsQuery = (kind: ClassroomKind, id: string | null) =>
  useQuery({
    queryKey: ["mentorship", "classroom", "details", kind, id],
    queryFn: () => getMentorshipClassroomDetails({ kind, id: id as string }),
    enabled: !!id,
    // Re-checks the join window / roster each time the tab regains focus,
    // rather than on a timer - the pre-join screen is read once, not watched.
    refetchOnWindowFocus: true,
  });

export const useClassroomJoinMutation = () => useMutation({ mutationFn: postMentorshipClassroomJoin });

export const useClassroomLeaveMutation = () => useMutation({ mutationFn: postMentorshipClassroomLeave });

/**
 * Chat has no real-time push transport available in this environment (see the
 * final handoff notes), so it polls - but only once the viewer has actually
 * joined the live session (`enabled`/the 4s interval only run while that's
 * true), which is exactly the "a timer that runs only while something the
 * user started is in progress" case that doesn't carry a hosting-cost risk:
 * nobody can leave this polling running in a background tab indefinitely,
 * because leaving the call also stops it.
 */
export const useClassroomChatListQuery = (kind: ClassroomKind, id: string | null, isJoined: boolean) =>
  useQuery({
    queryKey: ["mentorship", "classroom", "chat", kind, id],
    queryFn: () => getMentorshipClassroomChatList({ kind, id: id as string, limit: 100 }),
    enabled: !!id && isJoined,
    refetchInterval: isJoined ? 4000 : false,
  });

export const useClassroomChatSendMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipClassroomChatSend,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["mentorship", "classroom", "chat", variables.kind, variables.id] }),
  });
};

export const useClassroomMaterialsQuery = (kind: ClassroomKind, id: string | null) =>
  useQuery({
    queryKey: ["mentorship", "classroom", "materials", kind, id],
    queryFn: () => getMentorshipClassroomMaterials({ kind, id: id as string }),
    enabled: !!id,
  });

export const useClassroomMaterialAddMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipClassroomMaterialAdd,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["mentorship", "classroom", "materials", variables.kind, variables.id] }),
  });
};

export const useClassroomMaterialDeleteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipClassroomMaterialDelete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mentorship", "classroom", "materials"] }),
  });
};

export const useClassroomCompleteMutation = () => useMutation({ mutationFn: postMentorshipClassroomComplete });

export const useMentorshipReviewMutation = () => useMutation({ mutationFn: postMentorshipReview });

export const useTeacherMentorshipNotesQuery = (kind: ClassroomKind, lessonId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ["mentorship", "teacher-notes", kind, lessonId],
    queryFn: () => getTeacherMentorshipNotes({ kind, lessonId: lessonId as string }),
    enabled: !!lessonId && enabled,
  });

export const useTeacherMentorshipNoteUpsertMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherMentorshipNoteUpsert,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["mentorship", "teacher-notes", variables.kind, variables.lessonId] }),
  });
};
