import { useQuery, useMutation, queryOptions } from "@tanstack/react-query";
import { getShopProductsList, InputType as ShopListInput } from "../endpoints/shop/list_GET.schema";
import { getShopProductDetails } from "../endpoints/shop/details_GET.schema";
import { getRelatedShopProducts } from "../endpoints/shop/related_GET.schema";
import { getShopPreviewPage } from "../endpoints/shop/preview-page_GET.schema";
import { getStudentPurchases, InputType as StudentPurchasesInput } from "../endpoints/student/shop/purchases_GET.schema";
import { postStudentShopDownload } from "../endpoints/student/shop/download_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const SHOP_PRODUCTS_QUERY_KEY = ["shop", "products"];
export const SHOP_PRODUCT_DETAILS_QUERY_KEY = (slug: string) => ["shop", "product", slug];
export const SHOP_RELATED_PRODUCTS_QUERY_KEY = (productId: number) => ["shop", "related", productId];
export const STUDENT_PURCHASES_QUERY_KEY = ["student", "purchases"];

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

// A rendered preview page never changes for a given file, so it is fetched once per session.
export const previewPageQueryOptions = (productId: number, page: number, fileId?: number | null) =>
  queryOptions({
    queryKey: ["shop", "previewPage", productId, fileId ?? null, page],
    queryFn: () => getShopPreviewPage({ productId, page, fileId: fileId || undefined }),
    staleTime: Infinity,
    retry: false,
  });

export const usePreviewPageQuery = (productId: number, page: number, enabled: boolean, fileId?: number | null) => {
  return useQuery({ ...previewPageQueryOptions(productId, page, fileId), enabled });
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