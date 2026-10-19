import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminPromoCodes } from "../endpoints/admin/promo-codes/list_GET.schema";
import { postAdminUpsertPromoCode, InputType as UpsertPromoCodeInput } from "../endpoints/admin/promo-codes/upsert_POST.schema";
import { postAdminTogglePromoCode, InputType as TogglePromoCodeInput } from "../endpoints/admin/promo-codes/toggle_POST.schema";

export const ADMIN_PROMO_CODES_QUERY_KEY = ["admin", "promoCodes"];

export function useAdminPromoCodesQuery() {
  return useQuery({
    queryKey: ADMIN_PROMO_CODES_QUERY_KEY,
    queryFn: () => getAdminPromoCodes(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpsertPromoCodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpsertPromoCodeInput) => postAdminUpsertPromoCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PROMO_CODES_QUERY_KEY });
      toast.success("Promo code saved");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
}

export function useTogglePromoCodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TogglePromoCodeInput) => postAdminTogglePromoCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PROMO_CODES_QUERY_KEY });
      toast.success("Promo code status updated");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
}
