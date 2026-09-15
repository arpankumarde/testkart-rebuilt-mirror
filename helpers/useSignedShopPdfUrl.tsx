import { useQuery } from "@tanstack/react-query";
import { postStudentShopViewUrl } from "../endpoints/student/shop/view-url_POST.schema";

const STALE_TIME_MS = 20 * 60 * 1000; // 20 minutes (URL itself expires in 30)

type UseSignedShopPdfUrlOptions = {
  productId: number | null;
  fileId?: number | null;
  enabled?: boolean;
};

/**
 * A React Query hook to fetch and cache a secure, short-lived signed URL for
 * viewing a purchased study-notes PDF in-app. This intentionally never
 * powers a downloadable <a href> — it's only meant to be handed to the
 * react-pdf viewer (see components/StudentShopPdfViewer.tsx).
 */
export const useSignedShopPdfUrl = ({
  productId,
  fileId,
  enabled = true,
}: UseSignedShopPdfUrlOptions) => {
  const queryKey = ["signedShopPdfUrl", productId, fileId ?? null];

  const isQueryEnabled = !!productId && enabled;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!productId) {
        throw new Error("Missing required parameters to fetch signed URL.");
      }
      return postStudentShopViewUrl({ productId, fileId: fileId ?? undefined });
    },
    enabled: isQueryEnabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 2,
  });

  return {
    signedUrl: data?.signedUrl ?? null,
    isLoading: isLoading || isFetching,
    error: error instanceof Error ? error : null,
  };
};
