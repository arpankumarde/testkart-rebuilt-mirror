import { useCallback, useMemo } from "react";
import { useListUrlParams, type ListUrlParamUpdates } from "./useListUrlParams";
import { OrderStatusArrayValues, type OrderStatus } from "./schema";
import {
  ORDER_DEVICE_TYPES,
  ORDER_GATEWAYS,
  ORDER_PAYMENT_MODES,
  ORDER_PLATFORMS,
} from "./orderAttribution";
import {
  ORDER_PRODUCT_TYPES,
  ORDER_SORT_COLUMNS,
  type AdminOrderFilters,
  type AdminOrderSort,
} from "./adminOrderFilters";

/*
 * Every Transactions filter lives in the URL, so a filtered view can be
 * bookmarked or sent to a colleague, and dashboard tiles keep landing on
 * exactly what they counted (?status=pending&filter=stale-pending, ?promo=CODE).
 * Lists are comma separated. Changing any filter drops ?page so the list starts
 * again from the first page.
 */

export const DATE_RANGES = ["all", "today", "7d", "30d", "90d", "month", "custom"] as const;
export type DateRangePreset = (typeof DATE_RANGES)[number];

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  all: "All time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
  custom: "Custom range",
};

/** URL keys for the list filters, also the keys the chips and the panel use. */
export const LIST_KEYS = [
  "status",
  "platform",
  "os",
  "browser",
  "device",
  "brand",
  "method",
  "mode",
  "gateway",
  "product",
  "teacher",
  "promo",
] as const;
export type ListKey = (typeof LIST_KEYS)[number];

const LIST_ALLOWED: Partial<Record<ListKey, readonly string[]>> = {
  status: OrderStatusArrayValues,
  platform: ORDER_PLATFORMS,
  device: ORDER_DEVICE_TYPES,
  mode: ORDER_PAYMENT_MODES,
  gateway: ORDER_GATEWAYS,
  product: ORDER_PRODUCT_TYPES,
};

/** Filters that live in the expandable panel rather than the always-visible bar. */
export const ADVANCED_KEYS = [
  "method",
  "mode",
  "gateway",
  "os",
  "browser",
  "device",
  "brand",
  "product",
  "teacher",
  "promo",
  "discount",
  "amount",
  "paid",
] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string | null): Date | null {
  if (!value || !DAY.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function toDayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local-day bounds for a preset; the upper bound is exclusive. */
export function rangeBounds(
  preset: DateRangePreset,
  from: string | null,
  to: string | null,
  today: Date = new Date()
): { from?: Date; to?: Date } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrow = addDays(start, 1);
  switch (preset) {
    case "today":
      return { from: start, to: tomorrow };
    case "7d":
      return { from: addDays(start, -6), to: tomorrow };
    case "30d":
      return { from: addDays(start, -29), to: tomorrow };
    case "90d":
      return { from: addDays(start, -89), to: tomorrow };
    case "month":
      return { from: new Date(start.getFullYear(), start.getMonth(), 1), to: tomorrow };
    case "custom": {
      const f = parseDay(from);
      const t = parseDay(to);
      return { from: f ?? undefined, to: t ? addDays(t, 1) : undefined };
    }
    default:
      return {};
  }
}

const numberParam = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export type TransactionUrlState = {
  search: string;
  lists: Record<ListKey, string[]>;
  staleOnly: boolean;
  range: DateRangePreset;
  from: string | null;
  to: string | null;
  paidFrom: string | null;
  paidTo: string | null;
  discount: "with" | "without" | null;
  amountMin: number | undefined;
  amountMax: number | undefined;
  sort: AdminOrderSort;
  page: number;
};

export function useTransactionFilters() {
  const { searchParams, write } = useListUrlParams();
  const paramString = searchParams.toString();
  const dayKey = toDayString(new Date());

  const state = useMemo<TransactionUrlState>(() => {
    const params = new URLSearchParams(paramString);
    const lists = {} as Record<ListKey, string[]>;
    for (const key of LIST_KEYS) {
      const raw = params.get(key);
      const values = raw
        ? [...new Set(raw.split(",").map((v) => v.trim()).filter((v) => v && v.length <= 64))].slice(0, 30)
        : [];
      const allowed = LIST_ALLOWED[key];
      lists[key] = allowed ? values.filter((v) => allowed.includes(v)) : values;
    }
    lists.teacher = lists.teacher.filter((v) => /^\d{1,9}$/.test(v));

    const range = (DATE_RANGES as readonly string[]).includes(params.get("range") ?? "")
      ? (params.get("range") as DateRangePreset)
      : params.get("from") || params.get("to")
        ? "custom"
        : "all";
    const sortColumn = params.get("sort");
    const discount = params.get("discount");
    const page = Number(params.get("page"));

    return {
      search: (params.get("q") ?? "").slice(0, 120),
      lists,
      staleOnly: params.get("filter") === "stale-pending",
      range,
      from: params.get("from"),
      to: params.get("to"),
      paidFrom: params.get("paidFrom"),
      paidTo: params.get("paidTo"),
      discount: discount === "with" || discount === "without" ? discount : null,
      amountMin: numberParam(params.get("min")),
      amountMax: numberParam(params.get("max")),
      sort: {
        column: (ORDER_SORT_COLUMNS as readonly string[]).includes(sortColumn ?? "")
          ? (sortColumn as AdminOrderSort["column"])
          : "date",
        direction: params.get("dir") === "asc" ? "asc" : "desc",
      },
      page: Number.isInteger(page) && page > 0 ? page : 1,
    };
  }, [paramString]);

  const filters = useMemo<AdminOrderFilters>(() => {
    const { lists } = state;
    const created = rangeBounds(state.range, state.from, state.to);
    const paid = rangeBounds("custom", state.paidFrom, state.paidTo);
    const list = (values: string[]) => (values.length ? values : undefined);
    return {
      search: state.search || undefined,
      statuses: list(lists.status) as OrderStatus[] | undefined,
      stalePending: state.staleOnly || undefined,
      createdFrom: created.from,
      createdTo: created.to,
      paidFrom: paid.from,
      paidTo: paid.to,
      platforms: list(lists.platform) as AdminOrderFilters["platforms"],
      osNames: list(lists.os),
      browsers: list(lists.browser),
      deviceTypes: list(lists.device) as AdminOrderFilters["deviceTypes"],
      brands: list(lists.brand),
      paymentMethods: list(lists.method),
      paymentModes: list(lists.mode) as AdminOrderFilters["paymentModes"],
      gateways: list(lists.gateway) as AdminOrderFilters["gateways"],
      productTypes: list(lists.product) as AdminOrderFilters["productTypes"],
      teacherIds: lists.teacher.length ? lists.teacher.map(Number) : undefined,
      promoCodes: list(lists.promo),
      discount: state.discount ?? undefined,
      amountMin: state.amountMin,
      amountMax: state.amountMax,
    };
    // dayKey re-anchors relative ranges ("Last 7 days") when the date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dayKey]);

  /** Any filter change goes through here, so the page always resets with it. */
  const update = useCallback(
    (updates: ListUrlParamUpdates, keepPage = false) => write(keepPage ? updates : { ...updates, page: null }),
    [write]
  );

  const setList = useCallback(
    (key: ListKey, values: string[]) => update({ [key]: values.length ? values.join(",") : null }),
    [update]
  );

  const clearAll = useCallback(() => {
    const cleared: ListUrlParamUpdates = {
      q: null,
      filter: null,
      range: null,
      from: null,
      to: null,
      paidFrom: null,
      paidTo: null,
      discount: null,
      min: null,
      max: null,
      page: null,
    };
    for (const key of LIST_KEYS) cleared[key] = null;
    write(cleared);
  }, [write]);

  const advancedCount =
    (["method", "mode", "gateway", "os", "browser", "device", "brand", "product", "teacher", "promo"] as const).filter(
      (key) => state.lists[key].length > 0
    ).length +
    (state.discount ? 1 : 0) +
    (state.amountMin !== undefined || state.amountMax !== undefined ? 1 : 0) +
    (state.paidFrom || state.paidTo ? 1 : 0);

  const hasAnyFilter =
    !!state.search ||
    state.staleOnly ||
    state.range !== "all" ||
    LIST_KEYS.some((key) => state.lists[key].length > 0) ||
    advancedCount > 0;

  return { state, filters, update, setList, clearAll, advancedCount, hasAnyFilter };
}

export type TransactionFiltersApi = ReturnType<typeof useTransactionFilters>;
