import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { postAdminOrdersSearch } from "../endpoints/admin/orders/search_POST.schema";
import { postAdminOrdersSummary, type OrderBreakdown } from "../endpoints/admin/orders/summary_POST.schema";
import { getAdminOrdersFacets } from "../endpoints/admin/orders/facets_GET.schema";
import type { AdminOrderFilters, AdminOrderSort } from "./adminOrderFilters";

/*
 * Query hooks for the admin Transactions page. Every key starts with
 * ["admin", "orders"], the same prefix as useAdminOrdersQuery, so a refund,
 * reconcile or mark-failed invalidates the table, the figures and the facets
 * in one call.
 */
export const ADMIN_ORDERS_PREFIX = ["admin", "orders"] as const;

export const TRANSACTIONS_PAGE_SIZE = 50;

export const useAdminOrderSearch = (filters: AdminOrderFilters, sort: AdminOrderSort, page: number) =>
  useQuery({
    queryKey: [...ADMIN_ORDERS_PREFIX, "search", filters, sort, page],
    queryFn: () => postAdminOrdersSearch({ filters, sort, page, pageSize: TRANSACTIONS_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

export const useAdminOrderSummary = (filters: AdminOrderFilters, breakdown: OrderBreakdown) =>
  useQuery({
    queryKey: [...ADMIN_ORDERS_PREFIX, "summary", filters, breakdown],
    queryFn: () => postAdminOrdersSummary({ filters, breakdown }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

export const useAdminOrderFacets = () =>
  useQuery({
    queryKey: [...ADMIN_ORDERS_PREFIX, "facets"],
    queryFn: () => getAdminOrdersFacets(),
    staleTime: 10 * 60 * 1000,
  });
