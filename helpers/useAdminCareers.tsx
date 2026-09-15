import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCareersList } from "../endpoints/admin/careers/list_GET.schema";
import {
  postAdminCareerCreate,
  InputType as CreateInputType,
} from "../endpoints/admin/careers/create_POST.schema";
import {
  postAdminCareerUpdate,
  InputType as UpdateInputType,
} from "../endpoints/admin/careers/update_POST.schema";
import {
  postAdminCareerDelete,
  InputType as DeleteInputType,
} from "../endpoints/admin/careers/delete_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_CAREERS_QUERY_KEY = ["admin", "careers"] as const;

export const useAdminCareersQuery = () => {
  return useQuery({
    queryKey: ADMIN_CAREERS_QUERY_KEY,
    queryFn: () => getAdminCareersList(),
  });
};

export const useCreateCareerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInputType) => postAdminCareerCreate(data),
    onSuccess: () => {
      toast.success("Career posting created successfully");
      queryClient.invalidateQueries({ queryKey: ADMIN_CAREERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to create career posting"
      );
    },
  });
};

export const useUpdateCareerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateInputType) => postAdminCareerUpdate(data),
    onSuccess: () => {
      toast.success("Career posting updated successfully");
      queryClient.invalidateQueries({ queryKey: ADMIN_CAREERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to update career posting"
      );
    },
  });
};

export const useDeleteCareerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DeleteInputType) => postAdminCareerDelete(data),
    onSuccess: () => {
      toast.success("Career posting deleted successfully");
      queryClient.invalidateQueries({ queryKey: ADMIN_CAREERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to delete career posting"
      );
    },
  });
};