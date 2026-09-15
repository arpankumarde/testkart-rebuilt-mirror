import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postPromoCodesValidate } from "../endpoints/promo-codes/validate_POST.schema";
import { postTeacherPromoCodesCreate } from "../endpoints/teacher/promo-codes/create_POST.schema";
import { postTeacherPromoCodesUpdate } from "../endpoints/teacher/promo-codes/update_POST.schema";
import { postTeacherPromoCodesDelete } from "../endpoints/teacher/promo-codes/delete_POST.schema";
import { TEACHER_PROMO_CODES_QUERY_KEY } from "./useTeacherPromoCodes";

/**
 * Mutation hook for validating a promo code during checkout.
 * This is typically used by students.
 */
export const useValidatePromoCodeMutation = () => {
  return useMutation({
    mutationFn: postPromoCodesValidate,
    onError: (error) => {
      const errorMessage = parseErrorMessage(error) ||  "An unknown error occurred during validation.";
      toast.error(errorMessage);
      console.error("Promo code validation error:", error);
    },
  });
};

/**
 * Mutation hook for creating a new promo code.
 * Invalidates the teacher's promo code list on success.
 */
export const useCreatePromoCodeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherPromoCodesCreate,
    onSuccess: () => {
      toast.success("Promo code created successfully!");
      return queryClient.invalidateQueries({ queryKey: TEACHER_PROMO_CODES_QUERY_KEY });
    },
    onError: (error) => {
      const errorMessage = parseErrorMessage(error) ||  "Failed to create promo code.";
      toast.error(errorMessage);
      console.error("Create promo code error:", error);
    },
  });
};

/**
 * Mutation hook for updating an existing promo code.
 * Invalidates the teacher's promo code list on success.
 */
export const useUpdatePromoCodeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherPromoCodesUpdate,
    onSuccess: () => {
      toast.success("Promo code updated successfully!");
      return queryClient.invalidateQueries({ queryKey: TEACHER_PROMO_CODES_QUERY_KEY });
    },
    onError: (error) => {
      const errorMessage = parseErrorMessage(error) ||  "Failed to update promo code.";
      toast.error(errorMessage);
      console.error("Update promo code error:", error);
    },
  });
};

/**
 * Mutation hook for deleting (deactivating) a promo code.
 * Invalidates the teacher's promo code list on success.
 */
export const useDeletePromoCodeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherPromoCodesDelete,
    onSuccess: (data) => {
      toast.success(data.message);
      return queryClient.invalidateQueries({ queryKey: TEACHER_PROMO_CODES_QUERY_KEY });
    },
    onError: (error) => {
      const errorMessage = parseErrorMessage(error) ||  "Failed to delete promo code.";
      toast.error(errorMessage);
      console.error("Delete promo code error:", error);
    },
  });
};