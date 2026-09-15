import { useQuery } from "@tanstack/react-query";
import { getCoursesList, InputType } from "../endpoints/courses/list_GET.schema";
import { getCoursesDetails } from "../endpoints/courses/details_GET.schema";
import { getStudentEnrolledCourses } from "../endpoints/student/enrolled-courses_GET.schema";
import { getStudentCourseLessons } from "../endpoints/student/course/lessons_GET.schema";
import { getStudentCourseProgress } from "../endpoints/student/course/progress_GET.schema";

// Public course browsing
export const PUBLIC_COURSES_QUERY_KEY = ["public", "courses"];
export const PUBLIC_COURSE_DETAILS_QUERY_KEY = (slug: string) => [
  ...PUBLIC_COURSES_QUERY_KEY,
  "details",
  slug,
];

export const usePublicCoursesQuery = (filters: InputType = {}) => {
  return useQuery({
    queryKey: [...PUBLIC_COURSES_QUERY_KEY, filters],
    queryFn: () => getCoursesList(filters),
    placeholderData: (previousData) => previousData,
    staleTime: 10 * 60 * 1000,
  });
};

export const usePublicCourseDetailsQuery = (slug: string | null) => {
  return useQuery({
    queryKey: PUBLIC_COURSE_DETAILS_QUERY_KEY(slug!),
    queryFn: () => getCoursesDetails({ slug: slug! }),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });
};

// Student-specific (enrolled) courses
export const STUDENT_COURSES_QUERY_KEY = ["student", "courses"];
export const STUDENT_ENROLLED_COURSES_QUERY_KEY = [
  ...STUDENT_COURSES_QUERY_KEY,
  "enrolled",
];
export const STUDENT_COURSE_LESSONS_QUERY_KEY = (courseId: number) => [
  ...STUDENT_COURSES_QUERY_KEY,
  "lessons",
  courseId,
];
export const STUDENT_COURSE_PROGRESS_QUERY_KEY = (courseId: number) => [
  ...STUDENT_COURSES_QUERY_KEY,
  "progress",
  courseId,
];

export const useStudentEnrolledCoursesQuery = () => {
  return useQuery({
    queryKey: STUDENT_ENROLLED_COURSES_QUERY_KEY,
    queryFn: () => getStudentEnrolledCourses(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useStudentCourseLessonsQuery = (courseId: number | null) => {
  return useQuery({
    queryKey: STUDENT_COURSE_LESSONS_QUERY_KEY(courseId!),
    queryFn: () => getStudentCourseLessons({ courseId: courseId! }),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useStudentCourseProgressQuery = (courseId: number | null) => {
  return useQuery({
    queryKey: STUDENT_COURSE_PROGRESS_QUERY_KEY(courseId!),
    queryFn: () => getStudentCourseProgress({ courseId: courseId! }),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
};