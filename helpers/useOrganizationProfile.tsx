import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganizationsProfile } from "../endpoints/organizations/profile_GET.schema";
import { postOrganizationsFollow } from "../endpoints/organizations/follow_POST.schema";
import { getOrganizationsReviews } from "../endpoints/organizations/reviews_GET.schema";
import { postOrganizationsReviews, InputType as SubmitReviewInput } from "../endpoints/organizations/reviews_POST.schema";
import { postTeachersPostsLike } from "../endpoints/teachers/posts/like_POST.schema";

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

// Pages accumulate, so "Load more" appends older reviews instead of
// replacing the visible ones.
export const useOrganizationReviewsQuery = (organizationId: number, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ["organizationReviews", organizationId],
    queryFn: ({ pageParam }) => getOrganizationsReviews({ organizationId, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
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

export const useLikeOrganizationPostMutation = (orgSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => postTeachersPostsLike({ postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizationProfile", orgSlug] });
      queryClient.invalidateQueries({ queryKey: ["teacherPublicPosts"] });
    },
  });
};
