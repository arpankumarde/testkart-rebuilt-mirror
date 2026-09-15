import { useQuery } from "@tanstack/react-query";
import { postStudentCourseSignedPdfUrl } from "../endpoints/student/course/signed-pdf-url_POST.schema";

const STALE_TIME_MS = 25 * 60 * 1000; // 25 minutes

type UseSignedPdfUrlOptions = {
  courseId: number | null;
  lessonId: number | null;
  enabled?: boolean;
};

/**
 * A React Query hook to fetch and cache a secure, signed URL for a PDF course lesson.
 * It automatically handles refreshing the URL before it expires.
 *
 * @param options - The course ID, lesson ID, and an optional enabled flag.
 * @returns An object containing the signed URL, loading state, and any errors.
 */
export const useSignedPdfUrl = ({
  courseId,
  lessonId,
  enabled = true,
}: UseSignedPdfUrlOptions) => {
  const queryKey = ["signedPdfUrl", courseId, lessonId];

  const isQueryEnabled = !!courseId && !!lessonId && enabled;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: async () => {
      // Type safety check, enabled flag should prevent this from throwing in practice
      if (!courseId || !lessonId) {
        throw new Error("Missing required parameters to fetch signed URL.");
      }
      const result = await postStudentCourseSignedPdfUrl({
        courseId,
        lessonId,
      });
      return result;
    },
    enabled: isQueryEnabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false, // Prevent refetching just on window focus
    refetchOnMount: true, // Refetch if stale on mount
    retry: 2, // Retry failed requests twice
  });

  return {
    signedUrl: data?.signedUrl ?? null,
    isLoading: isLoading || isFetching,
    error: error instanceof Error ? error : null,
  };
};