import { useCallback, useMemo } from "react";
import { useListUrlParams, type ListUrlParamUpdates } from "./useListUrlParams";
import { ORDER_DEVICE_TYPES, ORDER_PLATFORMS } from "./orderAttribution";
import { NOT_CAPTURED } from "./adminOrderFilters";
import type { SubscriptionTransactionItem } from "../endpoints/admin/subscription-transactions/list_GET.schema";

/*
 * Subscription payments filters, kept in the URL like the student ones so a
 * view can be shared and the Breakdown popup reads the same selection. Keys
 * are prefixed with "s" so they never collide with the student filters. The
 * list is small (hundreds of rows), so matching happens in the browser with
 * matchesSubscriptionFilters, which the table and the breakdown both use.
 */

export const SUB_LIST_KEYS = ["sstatus", "splan", "splatform", "sos", "sbrowser", "sdevice", "sbrand"] as const;
export type SubListKey = (typeof SUB_LIST_KEYS)[number];

const ALLOWED: Partial<Record<SubListKey, readonly string[]>> = {
  sstatus: ["completed", "pending", "failed", "refunded"],
  splatform: ORDER_PLATFORMS,
  sdevice: ORDER_DEVICE_TYPES,
};

export type SubscriptionFilterState = {
  search: string;
  lists: Record<SubListKey, string[]>;
};

export function matchesSubscriptionFilters(t: SubscriptionTransactionItem, f: SubscriptionFilterState): boolean {
  if (f.search) {
    const q = f.search.toLowerCase();
    const hit =
      t.teacherName.toLowerCase().includes(q) ||
      (t.teacherEmail?.toLowerCase().includes(q) ?? false) ||
      (t.transactionId?.toLowerCase().includes(q) ?? false) ||
      `#${t.id}` === q ||
      String(t.id) === q;
    if (!hit) return false;
  }
  const { lists } = f;
  const facet = (selected: string[], value: string | null | undefined) =>
    selected.length === 0 || selected.includes(value ?? NOT_CAPTURED);
  if (lists.sstatus.length && !lists.sstatus.includes(t.status)) return false;
  if (lists.splan.length && !lists.splan.includes(t.planName)) return false;
  if (lists.splatform.length && !lists.splatform.includes(t.client?.platform ?? "unknown")) return false;
  if (lists.sdevice.length && !lists.sdevice.includes(t.client?.deviceType ?? "unknown")) return false;
  if (!facet(lists.sos, t.client?.osName)) return false;
  if (!facet(lists.sbrowser, t.client?.browserName)) return false;
  if (!facet(lists.sbrand, t.client?.deviceBrand)) return false;
  return true;
}

export function useSubscriptionTxFilters() {
  const { searchParams, write } = useListUrlParams();
  const paramString = searchParams.toString();

  const state = useMemo<SubscriptionFilterState & { page: number }>(() => {
    const params = new URLSearchParams(paramString);
    const lists = {} as Record<SubListKey, string[]>;
    for (const key of SUB_LIST_KEYS) {
      const raw = params.get(key);
      const values = raw ? [...new Set(raw.split(",").map((v) => v.trim()).filter((v) => v && v.length <= 80))].slice(0, 30) : [];
      const allowed = ALLOWED[key];
      lists[key] = allowed ? values.filter((v) => allowed.includes(v)) : values;
    }
    const page = Number(params.get("spage"));
    return {
      search: (params.get("sq") ?? "").slice(0, 120),
      lists,
      page: Number.isInteger(page) && page > 0 ? page : 1,
    };
  }, [paramString]);

  const update = useCallback(
    (updates: ListUrlParamUpdates, keepPage = false) => write(keepPage ? updates : { ...updates, spage: null }),
    [write]
  );

  const setList = useCallback(
    (key: SubListKey, values: string[]) => update({ [key]: values.length ? values.join(",") : null }),
    [update]
  );

  const clearAll = useCallback(() => {
    const cleared: ListUrlParamUpdates = { sq: null, spage: null };
    for (const key of SUB_LIST_KEYS) cleared[key] = null;
    write(cleared);
  }, [write]);

  const hasAnyFilter = !!state.search || SUB_LIST_KEYS.some((key) => state.lists[key].length > 0);

  return { state, update, setList, clearAll, hasAnyFilter };
}
