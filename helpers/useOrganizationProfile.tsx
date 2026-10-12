import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganizationsProfile } from "../endpoints/organizations/profile_GET.schema";
import { postOrganizationsFollow } from "../endpoints/organizations/follow_POST.schema";
import { getOrganizationsReviews, InputType as ReviewsInput } from "../endpoints/organizations/reviews_GET.schema";
import { postOrganizationsReviews, InputType as SubmitReviewInput } from "../endpoints/organizations/reviews_POST.schema";

export const useOrganizationProfileQuery = (orgSlug: string) =>
  useQuery({
    queryKey: ["organizationProfile", orgSlug],
    queryFn: () => getOrganizationsProfile({ orgSlug }),
    enabled: !!orgSlug,
    retry: (failureCount, error) => {
      if (error.message.includes("not found") || error.message.includes("404")) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useFollowOrganizationMutation = (orgSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: number) => postOrganizationsFollow({ organizationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizationProfile", orgSlug] });
    },
  });
};

export const useOrganizationReviewsQuery = (input: ReviewsInput, enabled: boolean) =>
  useQuery({
    queryKey: ["organizationReviews", input.organizationId, input.page],
    queryFn: () => getOrganizationsReviews(input),
    enabled,
    staleTime: 60 * 1000,
  });

export const useSubmitOrganizationReviewMutation = (organizationId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitReviewInput) => postOrganizationsReviews(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizationReviews", organizationId] });
    },
  });
};
