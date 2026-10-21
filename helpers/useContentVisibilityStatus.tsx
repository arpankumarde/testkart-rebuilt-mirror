import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContentType } from "./schema";
import { getTeacherContentVisibilityStatus } from "../endpoints/teacher/content-visibility/status_GET.schema";

export const CONTENT_VISIBILITY_QUERY_KEY = ["teacher", "contentVisibility"] as const;

/*
 * Visibility, live and review state for one teacher item. Publishing, taking
 * back or saving elsewhere on the page changes it, so any successful mutation
 * refetches it, the same way useContentRejection does.
 */
export function useContentVisibilityStatus(contentType: ContentType, contentId: number | null | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const active = enabled && typeof contentId === "number" && Number.isInteger(contentId) && contentId > 0;

  useEffect(() => {
    if (!active) return;
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        queryClient.invalidateQueries({ queryKey: CONTENT_VISIBILITY_QUERY_KEY });
      }
    });
  }, [active, queryClient]);

  return useQuery({
    queryKey: [...CONTENT_VISIBILITY_QUERY_KEY, contentType, contentId],
    queryFn: () => getTeacherContentVisibilityStatus({ contentType, contentId: contentId as number }),
    enabled: active,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
}