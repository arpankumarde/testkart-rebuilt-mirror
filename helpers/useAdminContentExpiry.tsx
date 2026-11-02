import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminContentExpiryList,
  type InputType as ListInput,
} from "../endpoints/admin/content-expiry/list_GET.schema";
import {
  postAdminContentExpiryUpdate,
  type InputType as UpdateInput,
} from "../endpoints/admin/content-expiry/update_POST.schema";
import {
  postAdminContentExpiryRelist,
  type InputType as RelistInput,
} from "../endpoints/admin/content-expiry/relist_POST.schema";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_CONTENT_EXPIRY_KEY = ["admin", "contentExpiry"] as const;

export function useAdminContentExpiryList(input: ListInput) {
  return useQuery({
    queryKey: [...ADMIN_CONTENT_EXPIRY_KEY, input],
    queryFn: () => getAdminContentExpiryList(input),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUpdateContentExpiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInput) => postAdminContentExpiryUpdate(input),
    onSuccess: (_data, input) => {
      toast.success(input.expiryDay === null ? "Expiry date removed" : "Expiry date saved");
      return queryClient.invalidateQueries({ queryKey: ADMIN_CONTENT_EXPIRY_KEY });
    },
    onError: (error: unknown) => {
      toast.error("Could not save the expiry date", { description: parseErrorMessage(error) });
    },
  });
}

export function useAdminRelistContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RelistInput) => postAdminContentExpiryRelist(input),
    onSuccess: (data) => {
      toast.success("Relisted", {
        description: data.visibility === "public" ? "Back on sale and listed publicly." : "Back on sale as unlisted.",
      });
      return queryClient.invalidateQueries({ queryKey: ADMIN_CONTENT_EXPIRY_KEY });
    },
    onError: (error: unknown) => {
      toast.error("Could not relist", { description: parseErrorMessage(error) });
    },
  });
}