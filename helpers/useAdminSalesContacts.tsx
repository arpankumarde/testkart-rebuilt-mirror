import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminSalesContacts,
  InputType as GetContactsInput,
} from "../endpoints/admin/sales/contacts_GET.schema";

import {
  postUpdateSalesContact,
  InputType as UpdateContactInput,
} from "../endpoints/admin/sales/contacts/update_POST.schema";

import {
  postBulkAssignSalesContacts,
  InputType as BulkAssignInput,
} from "../endpoints/admin/sales/contacts/bulk-assign_POST.schema";

import { postSyncSalesContacts } from "../endpoints/admin/sales/contacts/sync_POST.schema";

import { getAdminSalesTeam } from "../endpoints/admin/sales/team_GET.schema";

import { toast } from "sonner";

export const ADMIN_SALES_CONTACTS_QUERY_KEY = "admin-sales-contacts";
export const ADMIN_SALES_TEAM_QUERY_KEY = "admin-sales-team";

export const useAdminSalesContactsQuery = (params: GetContactsInput) => {
  return useQuery({
    queryKey: [ADMIN_SALES_CONTACTS_QUERY_KEY, params],
    queryFn: () => getAdminSalesContacts(params),
  });
};



export const useUpdateSalesContactMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateContactInput) => postUpdateSalesContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SALES_CONTACTS_QUERY_KEY] });
    },
  });
};

export const useBulkAssignSalesContactsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkAssignInput) => postBulkAssignSalesContacts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SALES_CONTACTS_QUERY_KEY] });
      toast.success("Contacts assigned successfully");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to assign contacts");
    },
  });
};

export const useAdminSalesTeamQuery = () => {
  return useQuery({
    queryKey: [ADMIN_SALES_TEAM_QUERY_KEY],
    queryFn: () => getAdminSalesTeam(),
  });
};

export const useSyncSalesContactsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => postSyncSalesContacts(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SALES_CONTACTS_QUERY_KEY] });
      toast.success(`Successfully synced ${data.syncedCount} contacts`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to sync contacts");
    },
  });
};