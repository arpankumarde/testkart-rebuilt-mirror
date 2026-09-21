import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminContentPreview,
  PreviewContentType,
  PreviewStatus,
} from "../endpoints/admin/content-preview/details_GET.schema";
import { getAdminContentPreviewQuestions } from "../endpoints/admin/content-preview/questions_GET.schema";
import { postAdminContentStatus, InputType as StatusInput } from "../endpoints/admin/content-preview/status_POST.schema";
import { parseErrorMessage } from "./parseErrorMessage";
import { ADMIN_CONTENT_REVIEWS_QUERY_KEY } from "./useAdminContentReviews";
import { ADMIN_COURSES_QUERY_KEY } from "./useAdminCourses";
import { ADMIN_PRODUCTS_QUERY_KEY } from "./useAdminProducts";
import { ADMIN_BUNDLES_QUERY_KEY } from "./useAdminBundles";
import { ADMIN_TESTS_QUERY_KEY } from "./useAdminTests";
import { ADMIN_LIVE_TESTS_QUERY_KEY } from "./useAdminLiveTests";
import { ADMIN_CATALOGUE_DASHBOARD_QUERY_KEY } from "./useAdminCatalogueDashboard";

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

/*
 * The admin lists never refetch on mount, so their cached pages are dropped
 * rather than invalidated; each list loads fresh the next time it opens.
 */
const STALE_AFTER_STATUS_CHANGE = [
  [ADMIN_CONTENT_REVIEWS_QUERY_KEY],
  ADMIN_COURSES_QUERY_KEY,
  ADMIN_PRODUCTS_QUERY_KEY,
  ADMIN_BUNDLES_QUERY_KEY,
  ADMIN_TESTS_QUERY_KEY,
  ADMIN_LIVE_TESTS_QUERY_KEY,
  ADMIN_CATALOGUE_DASHBOARD_QUERY_KEY,
];

export const useAdminContentStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StatusInput) => postAdminContentStatus(input),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin", "contentPreview"] });
      for (const queryKey of STALE_AFTER_STATUS_CHANGE) queryClient.removeQueries({ queryKey: [...queryKey] });
    },
    onError: (error: unknown) => {
      toast.error("Status not changed", { description: parseErrorMessage(error) });
    },
  });
};