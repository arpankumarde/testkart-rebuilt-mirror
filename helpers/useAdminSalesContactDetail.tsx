import { useQuery } from "@tanstack/react-query";
import { getAdminSalesContactDetail } from "../endpoints/admin/sales/contacts/detail_GET.schema";

export function useAdminSalesContactDetail(contactId: number | undefined) {
  return useQuery({
    queryKey: ["admin", "sales", "contacts", "detail", contactId],
    queryFn: () => {
      if (contactId === undefined) {
        throw new Error("contactId is required");
      }
      return getAdminSalesContactDetail({ contactId });
    },
    enabled: contactId !== undefined,
  });
}