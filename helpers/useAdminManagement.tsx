import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAdminsList } from "../endpoints/admin/admins/list_GET.schema";
import { postAdminAdminsCreate, InputType as CreateInputType } from "../endpoints/admin/admins/create_POST.schema";
import { postAdminAdminsUpdateRole, InputType as UpdateRoleInputType } from "../endpoints/admin/admins/update-role_POST.schema";
import { postAdminAdminsDeactivate, InputType as DeactivateInputType } from "../endpoints/admin/admins/deactivate_POST.schema";

export const ADMIN_LIST_QUERY_KEY = ["admin", "admins", "list"];
// Prefix of the list above and of the admin pickers' options (useAdminOptions).
const ADMINS_QUERY_PREFIX = ["admin", "admins"];

export function useAdminsList() {
  return useQuery({
    queryKey: ADMIN_LIST_QUERY_KEY,
    queryFn: () => getAdminAdminsList(),
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInputType) => postAdminAdminsCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMINS_QUERY_PREFIX });
    },
  });
}

export function useUpdateAdminRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRoleInputType) => postAdminAdminsUpdateRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMINS_QUERY_PREFIX });
    },
  });
}

export function useDeactivateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DeactivateInputType) => postAdminAdminsDeactivate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMINS_QUERY_PREFIX });
    },
  });
}