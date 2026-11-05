import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMentorshipTeacherOfferings } from "../endpoints/mentorship/teacher-offerings_GET.schema";
import { getMentorshipSlots } from "../endpoints/mentorship/slots_GET.schema";
import { postMentorshipPurchase } from "../endpoints/mentorship/purchase_POST.schema";
import { postMentorshipBookingCreate } from "../endpoints/mentorship/bookings/create_POST.schema";
import { getMentorshipBookingsList, InputType as BookingsListInput } from "../endpoints/mentorship/bookings/list_GET.schema";
import { postMentorshipBookingCancel } from "../endpoints/mentorship/bookings/cancel_POST.schema";
import { postMentorshipBookingReschedule } from "../endpoints/mentorship/bookings/reschedule_POST.schema";
import { getMentorshipGroupLessonsList, InputType as GroupLessonsListInput } from "../endpoints/mentorship/group-lessons/list_GET.schema";
import { getMentorshipGroupLesson } from "../endpoints/mentorship/group-lessons/get_GET.schema";
import { postMentorshipGroupLessonPurchase } from "../endpoints/mentorship/group-lessons/purchase_POST.schema";
import { postMentorshipGroupLessonEnroll } from "../endpoints/mentorship/group-lessons/enroll_POST.schema";
import { postMentorshipGroupLessonUnenroll } from "../endpoints/mentorship/group-lessons/unenroll_POST.schema";
import { getMentorshipMyGroupLessonEnrollments, InputType as MyGroupLessonEnrollmentsInput } from "../endpoints/mentorship/group-lessons/my-enrollments_GET.schema";

export const MENTORSHIP_BOOKINGS_QUERY_KEY = ["mentorship", "bookings"] as const;
export const MENTORSHIP_GROUP_LESSONS_QUERY_KEY = ["mentorship", "group-lessons"] as const;

export const useMentorshipTeacherOfferingsQuery = (teacherId: number | null) =>
  useQuery({
    queryKey: ["mentorship", "teacher-offerings", teacherId],
    queryFn: () => getMentorshipTeacherOfferings({ teacherId: teacherId as number }),
    enabled: !!teacherId,
  });

export const useMentorshipSlotsQuery = (
  teacherId: number | null,
  durationMinutes: number | null,
  from?: Date,
  to?: Date
) =>
  useQuery({
    queryKey: ["mentorship", "slots", teacherId, durationMinutes, from?.toISOString(), to?.toISOString()],
    queryFn: () => getMentorshipSlots({ teacherId: teacherId as number, durationMinutes: durationMinutes as number, from, to }),
    enabled: !!teacherId && !!durationMinutes,
  });

export const useMentorshipPurchaseMutation = () => useMutation({ mutationFn: postMentorshipPurchase });

export const useMentorshipBookingCreateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipBookingCreate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MENTORSHIP_BOOKINGS_QUERY_KEY }),
  });
};

export const useMentorshipBookingsListQuery = (input: BookingsListInput = {}) =>
  useQuery({
    queryKey: [...MENTORSHIP_BOOKINGS_QUERY_KEY, input.filter ?? "upcoming", input.limit],
    queryFn: () => getMentorshipBookingsList(input),
  });

export const useMentorshipBookingCancelMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipBookingCancel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MENTORSHIP_BOOKINGS_QUERY_KEY }),
  });
};

export const useMentorshipBookingRescheduleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipBookingReschedule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MENTORSHIP_BOOKINGS_QUERY_KEY }),
  });
};

export const useMentorshipGroupLessonsListQuery = (input: GroupLessonsListInput = {}) =>
  useQuery({
    queryKey: [...MENTORSHIP_GROUP_LESSONS_QUERY_KEY, "list", input.teacherId, input.subject, input.limit],
    queryFn: () => getMentorshipGroupLessonsList(input),
  });

export const useMentorshipGroupLessonQuery = (id: number | null) =>
  useQuery({
    queryKey: [...MENTORSHIP_GROUP_LESSONS_QUERY_KEY, "detail", id],
    queryFn: () => getMentorshipGroupLesson({ id: id as number }),
    enabled: !!id,
  });

export const useMentorshipGroupLessonPurchaseMutation = () => useMutation({ mutationFn: postMentorshipGroupLessonPurchase });

export const useMentorshipGroupLessonEnrollMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipGroupLessonEnroll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MENTORSHIP_GROUP_LESSONS_QUERY_KEY }),
  });
};

export const useMentorshipMyGroupLessonEnrollmentsQuery = (input: MyGroupLessonEnrollmentsInput = {}) =>
  useQuery({
    queryKey: [...MENTORSHIP_GROUP_LESSONS_QUERY_KEY, "my-enrollments", input.filter ?? "upcoming", input.limit],
    queryFn: () => getMentorshipMyGroupLessonEnrollments(input),
  });

export const useMentorshipGroupLessonUnenrollMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMentorshipGroupLessonUnenroll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MENTORSHIP_GROUP_LESSONS_QUERY_KEY }),
  });
};
