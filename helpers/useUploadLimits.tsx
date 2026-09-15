import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUploadLimits, OutputType as UploadLimitsType } from "../endpoints/upload-limits_GET.schema";
import { postAdminUploadLimitsUpdate, InputType as UpdateUploadLimitsInput } from "../endpoints/admin/upload-limits/update_POST.schema";

export const UPLOAD_LIMITS_QUERY_KEY = ["upload-limits"] as const;

export const DEFAULT_UPLOAD_LIMITS: UploadLimitsType = {
  thumbnailMaxMb: 3,
  profilePictureMaxMb: 2,
  kycDocumentMaxMb: 5,
  coursePdfMaxMb: 40,
  courseIntroVideoMaxMb: 50,
  lessonVideoMaxMb: 2048,
  digitalProductPdfMaxMb: 40,
  richTextImageMaxMb: 5,
};

export const useUploadLimitsQuery = () => {
  return useQuery({
    queryKey: UPLOAD_LIMITS_QUERY_KEY,
    queryFn: () => getUploadLimits(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const useUploadLimits = (): UploadLimitsType => {
  const { data } = useUploadLimitsQuery();
  return data ?? DEFAULT_UPLOAD_LIMITS;
};

export const useUpdateUploadLimitsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateUploadLimitsInput) => postAdminUploadLimitsUpdate(data),
    onSuccess: (updatedData) => {
      queryClient.setQueryData(UPLOAD_LIMITS_QUERY_KEY, updatedData);
      queryClient.invalidateQueries({ queryKey: UPLOAD_LIMITS_QUERY_KEY });
    },
  });
};