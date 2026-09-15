import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminWellKnownList } from "../endpoints/admin/well-known/list_GET.schema";
import { postAdminWellKnownUpdate, InputType as UpdateWellKnownInput } from "../endpoints/admin/well-known/update_POST.schema";

export const ADMIN_WELL_KNOWN_QUERY_KEY = ["admin", "wellKnown"] as const;

export const useAdminWellKnownQuery = () => {
  return useQuery({
    queryKey: ADMIN_WELL_KNOWN_QUERY_KEY,
    queryFn: () => getAdminWellKnownList(),
  });
};

export const useUpdateWellKnownMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateWellKnownInput) => postAdminWellKnownUpdate(data),
    onSuccess: () => {
      toast.success("File content updated successfully");
      queryClient.invalidateQueries({ queryKey: ADMIN_WELL_KNOWN_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) ||  "Failed to update file");
    },
  });
};