import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStudentEnrolledBundles } from "../endpoints/student/bundles/enrolled_GET.schema";
import { postBundlesPurchase } from "../endpoints/bundles/purchase_POST.schema";
import { PUBLIC_BUNDLE_DETAILS_QUERY_KEY } from "./useBundlesQuery";

export const STUDENT_ENROLLED_BUNDLES_QUERY_KEY = ["student", "bundles", "enrolled"];

/**
 * A React Query hook to fetch all course bundles the currently authenticated student is enrolled in.
 *
 * @returns The React Query result object.
 */
export const useEnrolledBundlesQuery = () => {
  return useQuery({
    queryKey: STUDENT_ENROLLED_BUNDLES_QUERY_KEY,
    queryFn: () => getStudentEnrolledBundles(),
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * A React Query hook that provides the mutation for purchasing a course bundle.
 *
 * On success, it invalidates the student's enrolled bundles list and the public
 * details page for the purchased bundle to update the UI (e.g., show "Go to Bundle" instead of "Buy Now").
 *
 * @returns The React Query mutation object for purchasing a bundle.
 */
export const usePurchaseBundleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postBundlesPurchase,
    onSuccess: (_, variables) => {
      // Invalidate enrolled bundles to show the new bundle in the student's dashboard.
      queryClient.invalidateQueries({
        queryKey: STUDENT_ENROLLED_BUNDLES_QUERY_KEY,
      });
      // Invalidate all public bundle details queries to update the 'isEnrolled' status on any details page.
      queryClient.invalidateQueries({
        queryKey: ["public", "bundles", "details"],
      });
    },
  });
};