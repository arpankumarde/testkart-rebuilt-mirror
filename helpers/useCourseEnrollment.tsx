import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postCoursesEnrollFree } from "../endpoints/courses/enroll-free_POST.schema";
import { postCoursesPurchase } from "../endpoints/courses/purchase_POST.schema";
import { postStudentCourseMarkComplete } from "../endpoints/student/course/mark-complete_POST.schema";
import { postStudentCourseMarkIncomplete } from "../endpoints/student/course/mark-incomplete_POST.schema";
import {
  STUDENT_ENROLLED_COURSES_QUERY_KEY,
  STUDENT_COURSE_PROGRESS_QUERY_KEY,
  PUBLIC_COURSE_DETAILS_QUERY_KEY,
} from "./useStudentCoursesQuery";
import { CART_QUERY_KEY } from "./useCartQuery";

export const useCourseEnrollment = () => {
  const queryClient = useQueryClient();

  const enrollFreeMutation = useMutation({
    mutationFn: postCoursesEnrollFree,
    onSuccess: (_, variables) => {
      // Refetch enrolled courses list and the details page to update 'isEnrolled' status
      queryClient.invalidateQueries({ queryKey: STUDENT_ENROLLED_COURSES_QUERY_KEY });
      // Invalidate all course details queries since we only have courseId but query key needs slug
      queryClient.invalidateQueries({ queryKey: ["courses", "public", "details"] });
      // Invalidate cart in case course was in cart
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: postCoursesPurchase,
    // On success, the frontend will redirect to PayU. Invalidation will happen
    // after the payment callback is successful. Also invalidate cart.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: postStudentCourseMarkComplete,
    onSuccess: (_, variables) => {
      // Find the courseId from the lessonId to invalidate the correct progress query
      // This is a limitation; ideally, the backend would return the courseId.
      // For now, we invalidate all progress queries as a workaround.
      queryClient.invalidateQueries({ queryKey: ["student", "courses", "progress"] });
      queryClient.invalidateQueries({ queryKey: STUDENT_ENROLLED_COURSES_QUERY_KEY });
    },
  });

  const markIncompleteMutation = useMutation({
    mutationFn: postStudentCourseMarkIncomplete,
    onSuccess: (_, variables) => {
      // Invalidate the same queries as mark-complete to update progress and enrollment data
      queryClient.invalidateQueries({ queryKey: ["student", "courses", "progress"] });
      queryClient.invalidateQueries({ queryKey: STUDENT_ENROLLED_COURSES_QUERY_KEY });
    },
  });

  return {
    enrollFreeMutation,
    purchaseMutation,
    markCompleteMutation,
    markIncompleteMutation,
  };
};