import { useQuery, useMutation } from "@tanstack/react-query";
import { getShopProductsList, InputType as ShopListInput } from "../endpoints/shop/list_GET.schema";
import { getShopProductDetails } from "../endpoints/shop/details_GET.schema";
import { getRelatedShopProducts } from "../endpoints/shop/related_GET.schema";
import { getShopPreviewUrl } from "../endpoints/shop/preview-url_GET.schema";
import { getStudentPurchases, InputType as StudentPurchasesInput } from "../endpoints/student/shop/purchases_GET.schema";
import { postStudentShopDownload } from "../endpoints/student/shop/download_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const SHOP_PRODUCTS_QUERY_KEY = ["shop", "products"];
export const SHOP_PRODUCT_DETAILS_QUERY_KEY = (slug: string) => ["shop", "product", slug];
export const SHOP_RELATED_PRODUCTS_QUERY_KEY = (productId: number) => ["shop", "related", productId];
export const STUDENT_PURCHASES_QUERY_KEY = ["student", "purchases"];
export const PREVIEW_URL_QUERY_KEY = (productId: number, fileId?: number | null) =>
  fileId ? ["shop", "previewUrl", productId, fileId] : ["shop", "previewUrl", productId];

// Public Shop Queries
export const useShopProductsQuery = (filters: ShopListInput) => {
  return useQuery({
    queryKey: [...SHOP_PRODUCTS_QUERY_KEY, filters],
    queryFn: () => getShopProductsList(filters),
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new page/filters
    staleTime: 10 * 60 * 1000,
  });
};

export const useShopProductDetails = (slug: string | null) => {
  return useQuery({
    queryKey: SHOP_PRODUCT_DETAILS_QUERY_KEY(slug!),
    queryFn: () => getShopProductDetails({ slug: slug! }),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });
};

export const useRelatedProductsQuery = (productId: number | null, limit?: number) => {
  return useQuery({
    queryKey: [...SHOP_RELATED_PRODUCTS_QUERY_KEY(productId!), { limit }],
    queryFn: () => getRelatedShopProducts({ productId: productId!, limit }),
    enabled: !!productId,
    staleTime: 15 * 60 * 1000,
  });
};

// Student Purchase Queries
export const useStudentPurchasesQuery = (params: StudentPurchasesInput = { page: 1, limit: 20 }) => {
  return useQuery({
    queryKey: [...STUDENT_PURCHASES_QUERY_KEY, params],
    queryFn: () => getStudentPurchases(params),
    placeholderData: (previousData) => previousData,
    staleTime: 10 * 60 * 1000,
  });
};

export const usePreviewUrlQuery = (productId: number | null, enabled: boolean, fileId?: number | null) => {
  return useQuery({
    queryKey: PREVIEW_URL_QUERY_KEY(productId!, fileId),
    queryFn: () => getShopPreviewUrl({ productId: productId!, fileId: fileId || undefined }),
    enabled: enabled && !!productId,
    staleTime: 4 * 60 * 1000, // 4 minutes (URL expires in 5)
    gcTime: 5 * 60 * 1000,
  });
};

// Student Mutations
export const useProductDownloadMutation = () => {
  return useMutation({
    mutationFn: postStudentShopDownload,
    onError: (error) => {
      toast.error(parseErrorMessage(error) ||  "Failed to generate download link");
    },
  });
};