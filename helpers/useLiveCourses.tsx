import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherLiveCourses } from "../endpoints/teacher/live-courses/list_GET.schema";
import { getTeacherLiveCourse } from "../endpoints/teacher/live-courses/get_GET.schema";
import { postTeacherLiveCourseUpsert, type InputType as UpsertInput } from "../endpoints/teacher/live-courses/upsert_POST.schema";
import { postTeacherLiveCourseSyllabus, type InputType as SyllabusInput } from "../endpoints/teacher/live-courses/syllabus_POST.schema";
import { postTeacherLiveCourseClassesAdd, type InputType as AddClassesInput } from "../endpoints/teacher/live-courses/classes/add_POST.schema";
import { postTeacherLiveCourseClassUpdate, type InputType as UpdateClassInput } from "../endpoints/teacher/live-courses/classes/update_POST.schema";
import { postTeacherLiveCourseClassCancel, type InputType as CancelClassInput } from "../endpoints/teacher/live-courses/classes/cancel_POST.schema";
import { postTeacherLiveCoursePublish, type InputType as PublishInput } from "../endpoints/teacher/live-courses/publish_POST.schema";
import { getTeacherLiveCourseStudents } from "../endpoints/teacher/live-courses/students_GET.schema";
import { postTeacherLiveCourseAttendance, type InputType as AttendanceInput } from "../endpoints/teacher/live-courses/attendance_POST.schema";
import { getLiveCourses, type InputType as ListInput } from "../endpoints/live-courses/list_GET.schema";
import { getLiveCourse } from "../endpoints/live-courses/get_GET.schema";
import { postLiveCoursePurchase } from "../endpoints/live-courses/purchase_POST.schema";
import { postLiveCourseRefund } from "../endpoints/live-courses/refund_POST.schema";
import { getStudentLiveCourses } from "../endpoints/student/live-courses/list_GET.schema";
import { getAdminLiveCourses, type InputType as AdminListInput } from "../endpoints/admin/live-courses/list_GET.schema";
import { getAdminLiveCourse } from "../endpoints/admin/live-courses/get_GET.schema";
import { postAdminLiveCourseAction, type InputType as AdminActionInput } from "../endpoints/admin/live-courses/action_POST.schema";

/* Live course data changes often and across roles, so these queries refetch whenever a screen mounts. */
const FRESH = { refetchOnMount: true, staleTime: 15_000 } as const;

const KEYS = {
  all: ["live-courses"] as const,
  teacherList: ["live-courses", "teacher", "list"] as const,
  teacherOne: (id: string) => ["live-courses", "teacher", id] as const,
  teacherStudents: (id: string) => ["live-courses", "teacher", id, "students"] as const,
  publicList: (input: ListInput) => ["live-courses", "public", "list", input] as const,
  publicOne: (key: string) => ["live-courses", "public", key] as const,
  student: ["live-courses", "student"] as const,
  adminList: (input: AdminListInput) => ["live-courses", "admin", "list", input] as const,
  adminOne: (id: string) => ["live-courses", "admin", id] as const,
};

const useInvalidateAll = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEYS.all });
};

/* ------------------------------------------------------------- teacher --- */

export const useTeacherLiveCoursesQuery = () =>
  useQuery({ queryKey: KEYS.teacherList, queryFn: () => getTeacherLiveCourses(), ...FRESH });

export const useTeacherLiveCourseQuery = (id: string) =>
  useQuery({ queryKey: KEYS.teacherOne(id), queryFn: () => getTeacherLiveCourse({ id }), enabled: !!id, ...FRESH });

export const useTeacherLiveCourseStudentsQuery = (id: string, enabled = true) =>
  useQuery({
    queryKey: KEYS.teacherStudents(id),
    queryFn: () => getTeacherLiveCourseStudents({ liveCourseId: id }),
    enabled: !!id && enabled,
    ...FRESH,
  });

export const useUpsertLiveCourseMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: UpsertInput) => postTeacherLiveCourseUpsert(input), onSuccess: invalidate });
};

export const useSaveSyllabusMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: SyllabusInput) => postTeacherLiveCourseSyllabus(input), onSuccess: invalidate });
};

export const useAddClassesMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: AddClassesInput) => postTeacherLiveCourseClassesAdd(input), onSuccess: invalidate });
};

export const useUpdateClassMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: UpdateClassInput) => postTeacherLiveCourseClassUpdate(input), onSuccess: invalidate });
};

export const useCancelClassMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: CancelClassInput) => postTeacherLiveCourseClassCancel(input), onSuccess: invalidate });
};

export const usePublishLiveCourseMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: PublishInput) => postTeacherLiveCoursePublish(input), onSuccess: invalidate });
};

export const useSaveAttendanceMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: AttendanceInput) => postTeacherLiveCourseAttendance(input), onSuccess: invalidate });
};

/* --------------------------------------------------------- public, student --- */

export const useLiveCoursesQuery = (input: ListInput = {}, enabled = true) =>
  useQuery({ queryKey: KEYS.publicList(input), queryFn: () => getLiveCourses(input), enabled, ...FRESH });

export const useLiveCourseQuery = (by: { slug?: string; id?: string }) =>
  useQuery({
    queryKey: KEYS.publicOne(by.id ?? by.slug ?? ""),
    queryFn: () => getLiveCourse(by),
    enabled: !!(by.id || by.slug),
    retry: false,
    ...FRESH,
  });

export const useStudentLiveCoursesQuery = (enabled = true) =>
  useQuery({ queryKey: KEYS.student, queryFn: () => getStudentLiveCourses(), enabled, ...FRESH });

export const usePurchaseLiveCourseMutation = () =>
  useMutation({ mutationFn: (liveCourseId: string) => postLiveCoursePurchase({ liveCourseId }) });

export const useRefundLiveCourseMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (liveCourseId: string) => postLiveCourseRefund({ liveCourseId }), onSuccess: invalidate });
};

/* ---------------------------------------------------------------- admin --- */

export const useAdminLiveCoursesQuery = (input: AdminListInput) =>
  useQuery({ queryKey: KEYS.adminList(input), queryFn: () => getAdminLiveCourses(input), ...FRESH });

export const useAdminLiveCourseQuery = (id: string) =>
  useQuery({ queryKey: KEYS.adminOne(id), queryFn: () => getAdminLiveCourse({ id }), enabled: !!id, ...FRESH });

export const useAdminLiveCourseActionMutation = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: AdminActionInput) => postAdminLiveCourseAction(input), onSuccess: invalidate });
};
