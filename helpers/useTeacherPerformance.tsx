import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherPerformanceStudents,
  InputType as StudentsInput,
} from "../endpoints/teacher/performance/students_GET.schema";
import { getTeacherPerformanceStudent } from "../endpoints/teacher/performance/student_GET.schema";
import {
  getTeacherPerformanceLeaderboard,
  InputType as LeaderboardInput,
} from "../endpoints/teacher/performance/leaderboard_GET.schema";
import { getTeacherPerformanceCourse } from "../endpoints/teacher/performance/course_GET.schema";
import { getTeacherPerformanceNote } from "../endpoints/teacher/performance/note_GET.schema";
import { getTeacherPerformanceAttempt } from "../endpoints/teacher/performance/attempt_GET.schema";

export const TEACHER_PERFORMANCE_QUERY_KEY = ["teacher", "performance"] as const;

// The app-wide client never refetches on mount; scores change every time a
// student submits, so reopening the page should show fresh ones.
const OPTIONS = {
  staleTime: 2 * 60 * 1000,
  refetchOnMount: true,
  placeholderData: <T,>(previous: T | undefined) => previous,
} as const;

export const useTeacherPerformanceStudents = (input: StudentsInput, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_PERFORMANCE_QUERY_KEY, "students", input],
    queryFn: () => getTeacherPerformanceStudents(input),
    enabled,
    ...OPTIONS,
  });

export const useTeacherPerformanceStudent = (studentId: number | null) =>
  useQuery({
    queryKey: [...TEACHER_PERFORMANCE_QUERY_KEY, "student", studentId],
    queryFn: () => getTeacherPerformanceStudent({ studentId: studentId as number }),
    enabled: studentId !== null,
    staleTime: OPTIONS.staleTime,
    refetchOnMount: true,
  });

export const useTeacherPerformanceLeaderboard = (input: LeaderboardInput, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_PERFORMANCE_QUERY_KEY, "leaderboard", input],
    queryFn: () => getTeacherPerformanceLeaderboard(input),
    enabled,
    ...OPTIONS,
  });

export const useTeacherPerformanceAttempt = (
  studentId: number | null,
  itemId: number | null,
  attemptId: number | null
) =>
  useQuery({
    queryKey: [...TEACHER_PERFORMANCE_QUERY_KEY, "attempt", studentId, itemId, attemptId],
    queryFn: () =>
      getTeacherPerformanceAttempt({
        studentId: studentId as number,
        itemId: itemId as number,
        attemptId: attemptId ?? undefined,
      }),
    enabled: studentId !== null && itemId !== null,
    staleTime: OPTIONS.staleTime,
    refetchOnMount: true,
    placeholderData: <T,>(previous: T | undefined) => previous,
  });

export const useTeacherPerformanceCourse = (courseId: number | null, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_PERFORMANCE_QUERY_KEY, "course", courseId],
    queryFn: () => getTeacherPerformanceCourse({ courseId: courseId ?? undefined }),
    enabled,
    ...OPTIONS,
  });

export const useTeacherPerformanceNote = (productId: number | null, enabled = true) =>
  useQuery({
    queryKey: [...TEACHER_PERFORMANCE_QUERY_KEY, "note", productId],
    queryFn: () => getTeacherPerformanceNote({ productId: productId ?? undefined }),
    enabled,
    ...OPTIONS,
  });

export const useRefreshTeacherPerformance = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: TEACHER_PERFORMANCE_QUERY_KEY });
};
