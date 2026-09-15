import type { PagePrefetchFn } from "@floot/prefetch";
import { getAdminSalesContacts } from "../endpoints/admin/sales/contacts_GET.schema";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  await qc.prefetchQuery({
    queryKey: ["admin-sales-contacts", {}],
    queryFn: () => getAdminSalesContacts({}),
  });
  return { maxAge: 60 };
};