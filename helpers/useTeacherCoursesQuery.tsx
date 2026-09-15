import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherCoursesList } from "../endpoints/teacher/courses/list_GET.schema";
import {
  getTeacherCoursesDetails,
  type OutputType as TeacherCourseDetails,
} from "../endpoints/teacher/courses/details_GET.schema";
import { postTeacherCoursesCreate } from "../endpoints/teacher/courses/create_POST.schema";
import { postTeacherCoursesUpdate } from "../endpoints/teacher/courses/update_POST.schema";
import { postTeacherCoursesDelete } from "../endpoints/teacher/courses/delete_POST.schema";
import { postTeacherCoursesPublish } from "../endpoints/teacher/courses/publish_POST.schema";
import { postTeacherCoursesUnpublish } from "../endpoints/teacher/courses/unpublish_POST.schema";
import { postTeacherCourseSectionsCreate } from "../endpoints/teacher/course-sections/create_POST.schema";
import { postTeacherCourseSectionsUpdate } from "../endpoints/teacher/course-sections/update_POST.schema";
import { postTeacherCourseSectionsDelete } from "../endpoints/teacher/course-sections/delete_POST.schema";
import { postTeacherCourseSectionsReorder } from "../endpoints/teacher/course-sections/reorder_POST.schema";
import { postTeacherCourseLessonsCreate } from "../endpoints/teacher/course-lessons/create_POST.schema";
import { postTeacherCourseLessonsUpdate } from "../endpoints/teacher/course-lessons/update_POST.schema";
import { postTeacherCourseLessonsDelete } from "../endpoints/teacher/course-lessons/delete_POST.schema";
import {
  postTeacherCourseLessonsReorder,
  type InputType as ReorderLessonsInput,
} from "../endpoints/teacher/course-lessons/reorder_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { TEACHER_DASHBOARD_STATS_QUERY_KEY } from "./useTeacherDashboardStats";

export const TEACHER_COURSES_QUERY_KEY = ["teacher", "courses"];
export const TEACHER_COURSE_DETAILS_QUERY_KEY = (courseId: number) => [
  ...TEACHER_COURSES_QUERY_KEY,
  "details",
  courseId,
];
const ALL_COURSE_DETAILS_QUERY_KEY = [...TEACHER_COURSES_QUERY_KEY, "details"];

// Queries
export const useTeacherCoursesQuery = () => {
  return useQuery({
    queryKey: TEACHER_COURSES_QUERY_KEY,
    queryFn: () => getTeacherCoursesList(),
    staleTime: 15 * 60 * 1000,
    // See the matching comment in useTeacherProductsQuery - refetchOnMount
    // is disabled globally, which also blocks the normal "refetch if
    // invalidated" check on remount, so this needs its own override to
    // actually pick up invalidations from the create/update/delete/publish
    // mutations below when the teacher navigates back to this list.
    refetchOnMount: true,
  });
};

/*
 * refetchOnMount keeps the editor fresh, so isFetching is true during every
 * background refresh. Callers gate their skeletons on "no data yet", never on
 * isFetching, or a refresh unmounts the editor mid-edit.
 */
export const useTeacherCourseDetailsQuery = (courseId: number | null) => {
  return useQuery({
    queryKey: TEACHER_COURSE_DETAILS_QUERY_KEY(courseId!),
    queryFn: () => getTeacherCoursesDetails({ courseId: courseId! }),
    enabled: !!courseId,
    refetchOnMount: true,
  });
};

type ReorderLessonsVariables = ReorderLessonsInput & { courseId: number };

// Mutations
export const useTeacherCourseMutations = () => {
  const queryClient = useQueryClient();

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: TEACHER_COURSES_QUERY_KEY });
    // The teacher dashboard's counts/top-items come from a separate,
    // independently cached endpoint - without this a new/updated/published
    // course never appears there until a manual page refresh.
    queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY });
  };

  const invalidateDetails = (courseId: number) =>
    queryClient.invalidateQueries({
      queryKey: TEACHER_COURSE_DETAILS_QUERY_KEY(courseId),
    });

  // Returned from onSuccess so the mutation stays pending until the curriculum
  // has refetched, and dialogs close on the updated list rather than the old one.
  const invalidateAllDetails = () =>
    queryClient.invalidateQueries({ queryKey: ALL_COURSE_DETAILS_QUERY_KEY });

  const applyOptimisticDetails = async (
    courseId: number,
    update: (details: TeacherCourseDetails) => TeacherCourseDetails,
  ) => {
    const key = TEACHER_COURSE_DETAILS_QUERY_KEY(courseId);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<TeacherCourseDetails>(key);
    if (previous) {
      queryClient.setQueryData<TeacherCourseDetails>(key, update(previous));
    }
    return { previous };
  };

  const reorderById = <T extends { id: number }>(items: T[], orderedIds: number[]): T[] => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered = orderedIds
      .map((id) => byId.get(id))
      .filter((item): item is T => item !== undefined);
    return ordered.length === items.length ? ordered : items;
  };

  // Course Mutations
  const createCourseMutation = useMutation({
    mutationFn: postTeacherCoursesCreate,
    onSuccess: () => invalidateLists(),
  });

  const updateCourseMutation = useMutation({
    mutationFn: postTeacherCoursesUpdate,
    onSuccess: (data) => {
      // Merge the saved row straight into the cached details so the form never
      // reopens on pre-save values while the refetch is still in flight.
      queryClient.setQueryData<TeacherCourseDetails>(
        TEACHER_COURSE_DETAILS_QUERY_KEY(data.id),
        (old) => (old ? { ...old, ...data } : old),
      );
      invalidateLists();
      invalidateDetails(data.id);
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: postTeacherCoursesDelete,
    onSuccess: () => invalidateLists(),
  });

  // Publish and unpublish own their toasts here; callers must not add their own.
  const publishCourseMutation = useMutation({
    mutationFn: postTeacherCoursesPublish,
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateLists();
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Could not publish the course");
    },
  });

  const unpublishCourseMutation = useMutation({
    mutationFn: postTeacherCoursesUnpublish,
    onSuccess: (data) => {
      invalidateLists();
      invalidateDetails(data.id);
      toast.success("Course unpublished. It is back in draft.");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to unpublish course");
    },
  });

  // Section Mutations
  const createSectionMutation = useMutation({
    mutationFn: postTeacherCourseSectionsCreate,
    onSuccess: (data) => invalidateDetails(data.courseId),
  });

  const updateSectionMutation = useMutation({
    mutationFn: postTeacherCourseSectionsUpdate,
    onSuccess: (data) => invalidateDetails(data.courseId),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: postTeacherCourseSectionsDelete,
    // The endpoint does not return courseId, so every cached course detail is invalidated.
    onSuccess: () => invalidateAllDetails(),
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: postTeacherCourseSectionsReorder,
    onMutate: (variables) =>
      applyOptimisticDetails(variables.courseId, (details) => ({
        ...details,
        sections: reorderById(details.sections, variables.orderedSectionIds),
      })),
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(TEACHER_COURSE_DETAILS_QUERY_KEY(variables.courseId), context.previous);
      }
      toast.error(parseErrorMessage(error) || "Could not move the section");
    },
    onSettled: (_data, _error, variables) => invalidateDetails(variables.courseId),
  });

  // Lesson Mutations
  const createLessonMutation = useMutation({
    mutationFn: postTeacherCourseLessonsCreate,
    onSuccess: () => invalidateAllDetails(),
  });

  const updateLessonMutation = useMutation({
    mutationFn: postTeacherCourseLessonsUpdate,
    onSuccess: () => invalidateAllDetails(),
  });

  const deleteLessonMutation = useMutation({
    mutationFn: postTeacherCourseLessonsDelete,
    onSuccess: () => invalidateAllDetails(),
  });

  const reorderLessonsMutation = useMutation({
    mutationFn: ({ courseId: _courseId, ...input }: ReorderLessonsVariables) =>
      postTeacherCourseLessonsReorder(input),
    onMutate: (variables) =>
      applyOptimisticDetails(variables.courseId, (details) => ({
        ...details,
        sections: details.sections.map((section) =>
          section.id === variables.sectionId
            ? { ...section, lessons: reorderById(section.lessons, variables.orderedLessonIds) }
            : section,
        ),
      })),
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(TEACHER_COURSE_DETAILS_QUERY_KEY(variables.courseId), context.previous);
      }
      toast.error(parseErrorMessage(error) || "Could not move the lesson");
    },
    onSettled: (_data, _error, variables) => invalidateDetails(variables.courseId),
  });

  return {
    createCourseMutation,
    updateCourseMutation,
    deleteCourseMutation,
    publishCourseMutation,
    unpublishCourseMutation,
    createSectionMutation,
    updateSectionMutation,
    deleteSectionMutation,
    reorderSectionsMutation,
    createLessonMutation,
    updateLessonMutation,
    deleteLessonMutation,
    reorderLessonsMutation,
  };
};
