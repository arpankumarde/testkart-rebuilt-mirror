import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSubjectSectionsList } from "../endpoints/teacher/subject-sections/list_GET.schema";
import { postSubjectSectionsCreate } from "../endpoints/teacher/subject-sections/create_POST.schema";
import { postSubjectSectionsUpdate } from "../endpoints/teacher/subject-sections/update_POST.schema";
import { postSubjectSectionsDelete } from "../endpoints/teacher/subject-sections/delete_POST.schema";
import { postTeacherSubjectSectionsReorder } from "../endpoints/teacher/subject-sections/reorder_POST.schema";

export const getSubjectSectionsQueryKey = (subjectId: number) => [
  "teacher",
  "subject-sections",
  subjectId,
];

export const useSubjectSectionsQuery = (subjectId: number | null) => {
  return useQuery({
    queryKey: getSubjectSectionsQueryKey(subjectId!),
    queryFn: () => getSubjectSectionsList({ subjectId: subjectId! }),
    enabled: subjectId !== null,
  });
};

export const useSubjectSectionsMutations = (subjectId: number) => {
  const queryClient = useQueryClient();

  const invalidateSectionsQuery = () => {
    return queryClient.invalidateQueries({
      queryKey: getSubjectSectionsQueryKey(subjectId),
    });
  };

  const useCreateSectionMutation = () => {
    return useMutation({
      mutationFn: postSubjectSectionsCreate,
      onSuccess: () => {
        invalidateSectionsQuery();
      },
    });
  };

  const useUpdateSectionMutation = () => {
    return useMutation({
      mutationFn: postSubjectSectionsUpdate,
      onSuccess: () => {
        invalidateSectionsQuery();
      },
    });
  };

  const useDeleteSectionMutation = () => {
    return useMutation({
      mutationFn: postSubjectSectionsDelete,
      onSuccess: () => {
        invalidateSectionsQuery();
      },
    });
  };

  const useReorderSectionsMutation = () => {
    return useMutation({
      mutationFn: postTeacherSubjectSectionsReorder,
      onSuccess: () => {
        invalidateSectionsQuery();
      },
    });
  };

  return {
    useCreateSectionMutation,
    useUpdateSectionMutation,
    useDeleteSectionMutation,
    useReorderSectionsMutation,
  };
};