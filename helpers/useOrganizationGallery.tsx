import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherOrganizationsGalleryList,
  InputType as GalleryListInput,
} from "../endpoints/teacher/organizations/gallery/list_GET.schema";
import {
  postTeacherOrganizationsGalleryAdd,
  InputType as GalleryAddInput,
} from "../endpoints/teacher/organizations/gallery/add_POST.schema";
import {
  postTeacherOrganizationsGalleryDelete,
  InputType as GalleryDeleteInput,
} from "../endpoints/teacher/organizations/gallery/delete_POST.schema";

export const organizationGalleryQueryKey = (organizationId: string) =>
  ["teacherOrganizationsGallery", organizationId] as const;

export const useOrganizationGalleryQuery = (organizationId: string | undefined) =>
  useQuery({
    queryKey: organizationGalleryQueryKey(organizationId ?? ""),
    queryFn: () => getTeacherOrganizationsGalleryList({ organizationId: organizationId as string }),
    enabled: Boolean(organizationId),
    staleTime: 15 * 1000,
  });

export const useAddOrganizationGalleryItemMutation = (organizationId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GalleryAddInput) => postTeacherOrganizationsGalleryAdd(input),
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: organizationGalleryQueryKey(organizationId) });
      }
    },
  });
};

export const useDeleteOrganizationGalleryItemMutation = (organizationId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GalleryDeleteInput) => postTeacherOrganizationsGalleryDelete(input),
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: organizationGalleryQueryKey(organizationId) });
      }
    },
  });
};

// Re-export types used by UI components for convenience.
export type { GalleryListInput, GalleryAddInput, GalleryDeleteInput };
