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
 * Chat is stored by the chat endpoints. In a Daily call each new message is also pushed to the
 * others as a Daily app message (components/ClassroomSession.tsx), so this poll is only the
 * fallback that catches anything missed: `intervalMs` is slow there and 4s for the development
 * mock, which has no push. It runs only while the viewer is in the session (`isJoined`), so
 * leaving the call stops it and no background tab can keep it running.
 */
export const useClassroomChatListQuery = (kind: ClassroomKind, id: string | null, isJoined: boolean, intervalMs = 4000) =>
  useQuery({
    queryKey: ["mentorship", "classroom", "chat", kind, id],
    queryFn: () => getMentorshipClassroomChatList({ kind, id: id as string, limit: 100 }),
    enabled: !!id && isJoined,
    refetchInterval: isJoined ? intervalMs : false,
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
