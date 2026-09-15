import { useQuery } from "@tanstack/react-query";
import { getTeacherProductDetails } from "../endpoints/teacher/products/details_GET.schema";

export const TEACHER_PRODUCT_DETAILS_QUERY_KEY = ["teacher", "product", "details"];

export const useTeacherProductDetailsQuery = (id: number | undefined) => {
  return useQuery({
    queryKey: [...TEACHER_PRODUCT_DETAILS_QUERY_KEY, id],
    queryFn: () => {
      if (!id) throw new Error("Product ID is required");
      return getTeacherProductDetails({ id });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    // refetchOnMount is off app-wide; without this, reopening the edit page
    // never re-checks a product that was changed elsewhere.
    refetchOnMount: true,
  });
};