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

export const organizationGalleryQueryKey = (organizationId: number) =>
  ["teacherOrganizationsGallery", organizationId] as const;

export const useOrganizationGalleryQuery = (organizationId: number | undefined) =>
  useQuery({
    queryKey: organizationGalleryQueryKey(organizationId ?? 0),
    queryFn: () => getTeacherOrganizationsGalleryList({ organizationId: organizationId as number }),
    enabled: typeof organizationId === "number" && organizationId > 0,
    staleTime: 15 * 1000,
  });

export const useAddOrganizationGalleryItemMutation = (organizationId: number | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GalleryAddInput) => postTeacherOrganizationsGalleryAdd(input),
    onSuccess: () => {
      if (typeof organizationId === "number") {
        queryClient.invalidateQueries({ queryKey: organizationGalleryQueryKey(organizationId) });
      }
    },
  });
};

export const useDeleteOrganizationGalleryItemMutation = (organizationId: number | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GalleryDeleteInput) => postTeacherOrganizationsGalleryDelete(input),
    onSuccess: () => {
      if (typeof organizationId === "number") {
        queryClient.invalidateQueries({ queryKey: organizationGalleryQueryKey(organizationId) });
      }
    },
  });
};

// Re-export types used by UI components for convenience.
export type { GalleryListInput, GalleryAddInput, GalleryDeleteInput };
