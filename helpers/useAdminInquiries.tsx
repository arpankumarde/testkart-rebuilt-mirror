import { useQuery } from "@tanstack/react-query";
import {
  getAdminInquiries,
  InputType,
} from "../endpoints/admin/inquiries_GET.schema";

export const ADMIN_INQUIRIES_QUERY_KEY = ["admin", "inquiries"] as const;

export const useAdminInquiriesQuery = (filters: InputType) => {
  return useQuery({
    queryKey: [...ADMIN_INQUIRIES_QUERY_KEY, filters],
    queryFn: () => getAdminInquiries(filters),
  });
};