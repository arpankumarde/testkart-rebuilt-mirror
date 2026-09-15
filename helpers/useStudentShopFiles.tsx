import { useQuery } from "@tanstack/react-query";
import { getStudentShopFiles } from "../endpoints/student/shop/files_GET.schema";

export const useStudentShopFiles = (productId?: number) => {
  return useQuery({
    queryKey: ["studentShopFiles", productId],
    queryFn: () => {
      if (!productId) throw new Error("productId is required");
      return getStudentShopFiles({ productId });
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000,
  });
};