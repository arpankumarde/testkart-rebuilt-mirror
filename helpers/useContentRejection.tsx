import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContentType } from "./schema";
import type { ContentRejection } from "./contentReviewStatus";
import { useAdminContentEdit } from "./useAdminContentEdit";
import { getTeacherContentReviewsRejection } from "../endpoints/teacher/content-reviews/rejection_GET.schema";

export const CONTENT_REJECTION_QUERY_KEY = ["teacher", "contentRejection"] as const;

/*
 * The admin's reason when a teacher's item was rejected and not yet resubmitted.
 * Always null inside the admin panel's editors. Any successful mutation on the
 * page (submit, take back, save) refetches it, so it drops away on resubmit.
 */
export function useContentRejection(
  contentType: ContentType,
  contentId: number | null | undefined
): ContentRejection | null {
  const adminEdit = useAdminContentEdit();
  const queryClient = useQueryClient();
  const enabled = !adminEdit && typeof contentId === "number" && Number.isInteger(contentId) && contentId > 0;

  useEffect(() => {
    if (!enabled) return;
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        queryClient.invalidateQueries({ queryKey: CONTENT_REJECTION_QUERY_KEY });
      }
    });
  }, [enabled, queryClient]);

  const { data } = useQuery({
    queryKey: [...CONTENT_REJECTION_QUERY_KEY, contentType, contentId],
    queryFn: () => getTeacherContentReviewsRejection({ contentType, contentId: contentId as number }),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });

  return enabled ? data?.rejection ?? null : null;
}