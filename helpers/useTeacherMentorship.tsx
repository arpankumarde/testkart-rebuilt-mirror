import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherMentorshipRate } from "../endpoints/teacher/mentorship/rate_GET.schema";
import { postTeacherMentorshipRate, InputType as RateSetInput } from "../endpoints/teacher/mentorship/rate_POST.schema";
import { getTeacherMentorshipAvailability } from "../endpoints/teacher/mentorship/availability/get_GET.schema";
import { postTeacherMentorshipAvailabilitySet, InputType as AvailabilitySetInput } from "../endpoints/teacher/mentorship/availability/set_POST.schema";
import { postTeacherMentorshipBlockedDateAdd, InputType as BlockedDateAddInput } from "../endpoints/teacher/mentorship/blocked-dates/add_POST.schema";
import { postTeacherMentorshipBlockedDateDelete } from "../endpoints/teacher/mentorship/blocked-dates/delete_POST.schema";
import { getTeacherGroupLessonsList } from "../endpoints/teacher/group-lessons/list_GET.schema";
import { postTeacherGroupLessonUpsert, InputType as GroupLessonUpsertInput } from "../endpoints/teacher/group-lessons/upsert_POST.schema";
import { postTeacherGroupLessonCancel, InputType as GroupLessonCancelInput } from "../endpoints/teacher/group-lessons/cancel_POST.schema";
import { getTeacherGroupLessonRoster } from "../endpoints/teacher/group-lessons/roster_GET.schema";
import { postTeacherGroupLessonRemoveParticipant, InputType as RemoveParticipantInput } from "../endpoints/teacher/group-lessons/remove-participant_POST.schema";
import { getMentorshipBookingsList, InputType as BookingsListInput } from "../endpoints/mentorship/bookings/list_GET.schema";
import { postMentorshipBookingCancel, InputType as BookingCancelInput } from "../endpoints/mentorship/bookings/cancel_POST.schema";
import { postMentorshipBookingReschedule, InputType as BookingRescheduleInput } from "../endpoints/mentorship/bookings/reschedule_POST.schema";
import { postMentorshipClassroomComplete, InputType as CompleteInput } from "../endpoints/mentorship/classroom/complete_POST.schema";

const KEYS = {
  rate: ["teacher", "mentorship", "rate"] as const,
  availability: ["teacher", "mentorship", "availability"] as const,
  groupLessons: ["teacher", "mentorship", "group-lessons"] as const,
  roster: (id: number) => ["teacher", "mentorship", "group-lessons", id, "roster"] as const,
  bookings: (filter: BookingsListInput["filter"]) => ["mentorship", "bookings", filter ?? "upcoming"] as const,
};

/* The live teaching apply checklist counts the rate and weekly hours. */
const LIVE_TEACHING_STATUS_KEY = ["teacher", "live-teaching", "status"] as const;

export const useTeacherMentorshipRateQuery = () =>
  useQuery({ queryKey: KEYS.rate, queryFn: () => getTeacherMentorshipRate() });

export const useSetTeacherMentorshipRateMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RateSetInput) => postTeacherMentorshipRate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.rate });
      qc.invalidateQueries({ queryKey: LIVE_TEACHING_STATUS_KEY });
    },
  });
};

export const useTeacherAvailabilityQuery = () =>
  useQuery({ queryKey: KEYS.availability, queryFn: () => getTeacherMentorshipAvailability() });

export const useSetAvailabilityMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AvailabilitySetInput) => postTeacherMentorshipAvailabilitySet(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.availability });
      qc.invalidateQueries({ queryKey: LIVE_TEACHING_STATUS_KEY });
    },
  });
};

export const useAddBlockedDateMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BlockedDateAddInput) => postTeacherMentorshipBlockedDateAdd(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.availability }),
  });
};

export const useDeleteBlockedDateMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postTeacherMentorshipBlockedDateDelete({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.availability }),
  });
};

export const useTeacherGroupLessonsQuery = () =>
  useQuery({ queryKey: KEYS.groupLessons, queryFn: () => getTeacherGroupLessonsList() });

export const useUpsertGroupLessonMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupLessonUpsertInput) => postTeacherGroupLessonUpsert(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.groupLessons }),
  });
};

export const useCancelGroupLessonMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GroupLessonCancelInput) => postTeacherGroupLessonCancel(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.groupLessons }),
  });
};

export const useGroupLessonRosterQuery = (groupLessonId: number | null) =>
  useQuery({
    queryKey: KEYS.roster(groupLessonId ?? 0),
    queryFn: () => getTeacherGroupLessonRoster({ groupLessonId: groupLessonId! }),
    enabled: groupLessonId !== null,
  });

export const useRemoveParticipantMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoveParticipantInput) => postTeacherGroupLessonRemoveParticipant(input),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.roster(variables.groupLessonId) });
      qc.invalidateQueries({ queryKey: KEYS.groupLessons });
    },
  });
};

export const useMentorshipBookingsQuery = (filter: BookingsListInput["filter"]) =>
  useQuery({ queryKey: KEYS.bookings(filter), queryFn: () => getMentorshipBookingsList({ filter }) });

export const useCancelBookingMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingCancelInput) => postMentorshipBookingCancel(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorship", "bookings"] }),
  });
};

export const useRescheduleBookingMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingRescheduleInput) => postMentorshipBookingReschedule(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorship", "bookings"] }),
  });
};

export const useCompleteLessonMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteInput) => postMentorshipClassroomComplete(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentorship", "bookings"] });
      qc.invalidateQueries({ queryKey: KEYS.groupLessons });
    },
  });
};
