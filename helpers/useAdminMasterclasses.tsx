import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminMasterclasses } from "../endpoints/admin/masterclasses/list_GET.schema";
import { getAdminMasterclassRegistrations } from "../endpoints/admin/masterclasses/registrations_GET.schema";
import { postAdminMasterclassUpsert } from "../endpoints/admin/masterclasses/upsert_POST.schema";
import { postAdminMasterclassMarkAttended } from "../endpoints/admin/masterclasses/mark-attended_POST.schema";

export const ADMIN_MASTERCLASSES_QUERY_KEY = ["admin", "masterclasses"] as const;

export const useAdminMasterclassesQuery = () =>
  useQuery({
    queryKey: ADMIN_MASTERCLASSES_QUERY_KEY,
    queryFn: () => getAdminMasterclasses(),
  });

export const useAdminMasterclassRegistrationsQuery = (masterclassId: number | null) =>
  useQuery({
    queryKey: ["admin", "masterclasses", "registrations", masterclassId],
    queryFn: () => getAdminMasterclassRegistrations({ masterclassId: masterclassId! }),
    enabled: masterclassId !== null,
  });

export const useUpsertMasterclassMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminMasterclassUpsert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_MASTERCLASSES_QUERY_KEY }),
  });
};

export const useMarkMasterclassAttendedMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminMasterclassMarkAttended,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "masterclasses", "registrations"] }),
  });
};
