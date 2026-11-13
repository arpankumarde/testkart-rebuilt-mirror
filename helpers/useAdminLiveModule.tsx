import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminLiveCalendar, type InputType as CalendarInput } from "../endpoints/admin/live-lessons/calendar_GET.schema";
import { getAdminLiveTeachers } from "../endpoints/admin/live-lessons/teachers_GET.schema";
import { getAdminLiveSession } from "../endpoints/admin/live-lessons/session_GET.schema";
import { getAdminLiveBookings, type InputType as BookingsInput } from "../endpoints/admin/live-lessons/bookings_GET.schema";
import { postAdminLiveOutcome, type InputType as OutcomeInput } from "../endpoints/admin/live-lessons/outcome_POST.schema";
import { postAdminLiveAttendance, type InputType as AttendanceInput } from "../endpoints/admin/live-lessons/attendance_POST.schema";

/* Every query here sits under this prefix, so a cancellation can refresh the whole module at once. */
export const ADMIN_LIVE_KEY = ["admin", "live-lessons"] as const;

export const useAdminLiveCalendarQuery = (input: CalendarInput) =>
  useQuery({
    queryKey: [...ADMIN_LIVE_KEY, "calendar", input],
    queryFn: () => getAdminLiveCalendar(input),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

export const useAdminLiveTeachersQuery = () =>
  useQuery({
    queryKey: [...ADMIN_LIVE_KEY, "teachers"],
    queryFn: () => getAdminLiveTeachers(),
    staleTime: 10 * 60 * 1000,
  });

export const useAdminLiveSessionQuery = (target: { kind: "booking"; id: string } | null) =>
  useQuery({
    queryKey: [...ADMIN_LIVE_KEY, "session", target?.kind, target?.id],
    queryFn: () => getAdminLiveSession(target!),
    enabled: !!target,
  });

export const useAdminLiveBookingsQuery = (input: BookingsInput) =>
  useQuery({
    queryKey: [...ADMIN_LIVE_KEY, "bookings", input],
    queryFn: () => getAdminLiveBookings(input),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

/* Set the teacher's session status (completed or missed); refreshes the calendar, drawers and bookings. */
export const useAdminLiveOutcomeMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OutcomeInput) => postAdminLiveOutcome(input),
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_LIVE_KEY }),
  });
};

/* Set one learner's attendance. */
export const useAdminLiveAttendanceMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttendanceInput) => postAdminLiveAttendance(input),
    onSettled: () => qc.invalidateQueries({ queryKey: ADMIN_LIVE_KEY }),
  });
};