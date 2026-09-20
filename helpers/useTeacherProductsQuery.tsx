import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherProductsList,
  InputType as TeacherListInput,
  TeacherProductListItem,
} from "../endpoints/teacher/products/list_GET.schema";
import { postTeacherProductsCreate } from "../endpoints/teacher/products/create_POST.schema";
import { postTeacherProductsUpdate } from "../endpoints/teacher/products/update_POST.schema";
import { postTeacherProductsDelete } from "../endpoints/teacher/products/delete_POST.schema";
import { postTeacherProductsPublish } from "../endpoints/teacher/products/publish_POST.schema";
import { postTeacherProductsUnpublish } from "../endpoints/teacher/products/unpublish_POST.schema";
import { postTeacherProductsBulk } from "../endpoints/teacher/products/bulk_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { CUSTOM_EXAM_NAMES_QUERY_KEY } from "./useExamNameSuggestions";
import { TEACHER_PRODUCT_DETAILS_QUERY_KEY } from "./useTeacherProductDetailsQuery";
import { TEACHER_DASHBOARD_STATS_QUERY_KEY } from "./useTeacherDashboardStats";

export const TEACHER_PRODUCTS_QUERY_KEY = ["teacher", "products"];

export const useTeacherProductsQuery = (filters: TeacherListInput = { page: 1, limit: 20 }) => {
  return useQuery({
    queryKey: [...TEACHER_PRODUCTS_QUERY_KEY, filters],
    queryFn: () => getTeacherProductsList(filters),
    placeholderData: (previousData) => previousData,
    staleTime: 15 * 60 * 1000,
    // refetchOnMount is off app-wide, which also stops a remount from picking
    // up an invalidation fired while the list was unmounted (create and edit
    // happen on other pages). This restores "refetch when stale" here.
    refetchOnMount: true,
  });
};

const PUBLISHED_PAGE_SIZE = 100;
const PUBLISHED_MAX_PAGES = 20;

// Every published product, for pickers such as the bundle form. The list
// endpoint caps a page at 100, so this walks pages until a short one.
export const usePublishedTeacherProductsQuery = () => {
  return useQuery({
    queryKey: [...TEACHER_PRODUCTS_QUERY_KEY, "all-published"],
    queryFn: async () => {
      const products: TeacherProductListItem[] = [];
      for (let page = 1; page <= PUBLISHED_MAX_PAGES; page++) {
        const result = await getTeacherProductsList({ status: "published", page, limit: PUBLISHED_PAGE_SIZE });
        products.push(...result.products);
        if (result.products.length < PUBLISHED_PAGE_SIZE) break;
      }
      return products;
    },
    staleTime: 15 * 60 * 1000,
    refetchOnMount: true,
  });
};

const BULK_VERBS = { publish: "Submitted for review:", unpublish: "Unpublished", archive: "Archived" } as const;

type MutationOptions = {
  // The product form reports each outcome in one toast of its own, so it
  // turns the per-mutation toasts off and handles success and failure itself.
  silent?: boolean;
};

export const useTeacherProductMutations = ({ silent = false }: MutationOptions = {}) => {
  const queryClient = useQueryClient();

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: TEACHER_PRODUCTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY });
  };

  const notifySuccess = (message: string) => {
    if (!silent) toast.success(message);
  };
  const notifyError = (error: unknown, fallback: string) => {
    if (!silent) toast.error(parseErrorMessage(error) || fallback);
  };

  const createProductMutation = useMutation({
    mutationFn: postTeacherProductsCreate,
    onSuccess: (data) => {
      notifySuccess("Product created");
      invalidateList();
      queryClient.invalidateQueries({ queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY });
      // Seeds the edit page the teacher is sent to next, files included.
      queryClient.setQueryData([...TEACHER_PRODUCT_DETAILS_QUERY_KEY, data.id], data);
    },
    onError: (error) => notifyError(error, "Failed to create product"),
  });

  const updateProductMutation = useMutation({
    mutationFn: postTeacherProductsUpdate,
    onSuccess: (data) => {
      notifySuccess("Changes saved");
      invalidateList();
      queryClient.invalidateQueries({ queryKey: CUSTOM_EXAM_NAMES_QUERY_KEY });
      queryClient.setQueryData(
        [...TEACHER_PRODUCT_DETAILS_QUERY_KEY, data.id],
        (previous: object | undefined) => ({ ...(previous ?? {}), ...data })
      );
    },
    onError: (error) => notifyError(error, "Failed to update product"),
  });

  const deleteProductMutation = useMutation({
    mutationFn: postTeacherProductsDelete,
    onSuccess: () => {
      notifySuccess("Product deleted permanently");
      invalidateList();
    },
    onError: (error) => notifyError(error, "Failed to delete product"),
  });

  const publishProductMutation = useMutation({
    mutationFn: postTeacherProductsPublish,
    onSuccess: (data, variables) => {
      notifySuccess(data.message);
      invalidateList();
      queryClient.invalidateQueries({ queryKey: [...TEACHER_PRODUCT_DETAILS_QUERY_KEY, variables.id] });
    },
    onError: (error) => notifyError(error, "Failed to submit product for review"),
  });

  const unpublishProductMutation = useMutation({
    mutationFn: postTeacherProductsUnpublish,
    onSuccess: (data) => {
      notifySuccess("Product unpublished");
      invalidateList();
      queryClient.invalidateQueries({ queryKey: [...TEACHER_PRODUCT_DETAILS_QUERY_KEY, data.id] });
    },
    onError: (error) => notifyError(error, "Failed to unpublish product"),
  });

  const bulkActionMutation = useMutation({
    mutationFn: postTeacherProductsBulk,
    onSuccess: (data, variables) => {
      invalidateList();
      const verb = BULK_VERBS[variables.action];
      const done = data.succeeded.length;
      const plural = (n: number) => `${n} product${n === 1 ? "" : "s"}`;
      if (data.failed.length === 0) {
        toast.success(`${verb} ${plural(done)}.`);
        return;
      }
      const description = React.createElement(
        "ul",
        { style: { margin: 0, paddingLeft: "1rem" } },
        data.failed.map((f) =>
          React.createElement("li", { key: f.id }, `${f.title ? `"${f.title}"` : `Product ${f.id}`}: ${f.reason}`)
        )
      );
      const headline = done === 0
        ? `Nothing was ${variables.action === "publish" ? "submitted for review" : verb.toLowerCase()}. ${plural(data.failed.length)} skipped:`
        : `${verb} ${plural(done)}. ${plural(data.failed.length)} skipped:`;
      (done === 0 ? toast.error : toast.warning)(headline, { description, duration: 12000 });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Bulk action failed");
    },
  });

  return {
    createProductMutation,
    updateProductMutation,
    deleteProductMutation,
    publishProductMutation,
    unpublishProductMutation,
    bulkActionMutation,
  };
};
