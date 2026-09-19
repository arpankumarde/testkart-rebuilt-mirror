import { useQuery } from "@tanstack/react-query";
import { postStudentCourseSignedVideoUrl } from "../endpoints/student/course/signed-video-url_POST.schema";

// The endpoint provides a URL that expires in 30 minutes (1800 seconds).
// We set the staleTime to 25 minutes (1500 seconds) to ensure we refetch a new URL
// a few minutes before the old one expires, providing a seamless viewing experience.
// A Gumlet (DRM) lesson that is still processing is rechecked every 20 seconds.
const STALE_TIME_MS = 25 * 60 * 1000;
const GUMLET_PROCESSING_RECHECK_MS = 20 * 1000;

type UseSignedVideoUrlOptions = {
  courseId: number | null;
  lessonId: number | null;
  videoUrl: string | null;
  enabled?: boolean;
};

/**
 * A React Query hook to fetch and cache a secure, signed URL for a course lesson video.
 * It automatically handles refreshing the URL before it expires.
 *
 * @param options - The course ID, lesson ID, original video URL, and an optional enabled flag.
 * @returns An object containing the signed URL, loading state, and any errors.
 */
export const useSignedVideoUrl = ({
  courseId,
  lessonId,
  videoUrl,
  enabled = true,
}: UseSignedVideoUrlOptions) => {
  const queryKey = ["signedVideoUrl", courseId, lessonId, videoUrl];

  const isQueryEnabled =
    !!courseId && !!lessonId && !!videoUrl && enabled;

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      // This check is for type safety, the 'enabled' flag should prevent this from running.
      if (!courseId || !lessonId || !videoUrl) {
        throw new Error("Missing required parameters to fetch signed URL.");
      }
      const result = await postStudentCourseSignedVideoUrl({
        courseId,
        lessonId,
        videoUrl,
      });
      return result;
    },
    enabled: isQueryEnabled,
    staleTime: STALE_TIME_MS,
    refetchInterval: (query) =>
      query.state.data?.gumletState === "processing" ? GUMLET_PROCESSING_RECHECK_MS : false,
    refetchOnWindowFocus: false, // Prevent refetching just on window focus
    refetchOnMount: true, // Refetch if stale on mount
    retry: 2, // Retry failed requests twice
  });

  return {
    signedUrl: data?.signedUrl || null,
    player: data?.player ?? null,
    gumletState: data?.gumletState ?? null,
    isLoading: isLoading || (isFetching && data?.gumletState !== "processing"),
    error: error instanceof Error ? error : null,
  };
};