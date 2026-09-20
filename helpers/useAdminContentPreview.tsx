import { useQuery } from "@tanstack/react-query";
import {
  getAdminContentPreview,
  PreviewContentType,
  PreviewStatus,
} from "../endpoints/admin/content-preview/details_GET.schema";
import { getAdminContentPreviewQuestions } from "../endpoints/admin/content-preview/questions_GET.schema";

export const adminPreviewPath = (type: PreviewContentType, id: number) => `/admin/preview/${type}/${id}`;

export const PREVIEW_TYPE_LABELS: Record<PreviewContentType, string> = {
  mock_test: "Test series",
  course: "Course",
  digital_product: "Study notes",
  course_bundle: "Bundle",
  live_test: "Live test",
};

export const PREVIEW_STATUS_LABELS: Record<PreviewStatus, string> = {
  published: "Published",
  draft: "Draft",
  unpublished: "Unpublished",
  archived: "Archived",
  trashed: "In trash",
};

export const useAdminContentPreview = (type: PreviewContentType | null, id: number | null) =>
  useQuery({
    queryKey: ["admin", "contentPreview", type, id],
    queryFn: () => getAdminContentPreview({ type: type!, id: id! }),
    enabled: !!type && !!id,
    refetchOnMount: true,
    staleTime: 30 * 1000,
    retry: false,
  });

export const useAdminPreviewQuestions = (testItemId: number, enabled: boolean) =>
  useQuery({
    queryKey: ["admin", "contentPreview", "questions", testItemId],
    queryFn: () => getAdminContentPreviewQuestions({ testItemId }),
    enabled,
    refetchOnMount: true,
    staleTime: 30 * 1000,
  });