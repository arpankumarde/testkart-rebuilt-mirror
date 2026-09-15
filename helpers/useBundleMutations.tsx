import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postTeacherBundlesCreate } from "../endpoints/teacher/bundles/create_POST.schema";
import { postTeacherBundlesUpdate } from "../endpoints/teacher/bundles/update_POST.schema";
import { postTeacherBundlesDelete } from "../endpoints/teacher/bundles/delete_POST.schema";
import { postTeacherBundlesPublish } from "../endpoints/teacher/bundles/publish_POST.schema";
import { TEACHER_BUNDLES_QUERY_KEY } from "./useTeacherBundlesQuery";
import { TEACHER_BUNDLE_DETAILS_QUERY_KEY } from "./useTeacherBundleDetailsQuery";
import {
  PUBLIC_BUNDLES_QUERY_KEY,
  PUBLIC_BUNDLE_DETAILS_QUERY_KEY,
} from "./useBundlesQuery";
import { TEACHER_DASHBOARD_STATS_QUERY_KEY } from "./useTeacherDashboardStats";

// Teacher bundle mutations. Each shows exactly one toast per outcome, and a
// failure always shows the server's own message.
export const useBundleMutations = () => {
  const queryClient = useQueryClient();

  const invalidateTeacherAndPublicLists = () => {
    queryClient.invalidateQueries({ queryKey: TEACHER_BUNDLES_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: PUBLIC_BUNDLES_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: TEACHER_BUNDLE_DETAILS_QUERY_KEY });
    // The dashboard counts come from a separately cached endpoint.
    queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY });
  };

  const createBundleMutation = useMutation({
    mutationFn: postTeacherBundlesCreate,
    onSuccess: () => {
      toast.success("Bundle created");
      invalidateTeacherAndPublicLists();
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to create bundle");
    },
  });

  const updateBundleMutation = useMutation({
    mutationFn: postTeacherBundlesUpdate,
    onSuccess: (data) => {
      toast.success("Changes saved");
      invalidateTeacherAndPublicLists();
      queryClient.invalidateQueries({
        queryKey: PUBLIC_BUNDLE_DETAILS_QUERY_KEY(data.slug),
      });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update bundle");
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: postTeacherBundlesDelete,
    onSuccess: () => {
      toast.success("Bundle deleted");
      invalidateTeacherAndPublicLists();
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to delete bundle");
    },
  });

  const publishBundleMutation = useMutation({
    mutationFn: postTeacherBundlesPublish,
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateTeacherAndPublicLists();
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update bundle status");
    },
  });

  return {
    createBundleMutation,
    updateBundleMutation,
    deleteBundleMutation,
    publishBundleMutation,
  };
};