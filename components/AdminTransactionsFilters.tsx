import React, { useEffect, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { AdminFacetSelect, type FacetSelectOption } from "./AdminFacetSelect";
import { OrderPlatformIcon } from "./OrderPlatformBadge";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import {
  DATE_RANGE_LABELS,
  DATE_RANGES,
  type DateRangePreset,
  type ListKey,
  type TransactionFiltersApi,
} from "../helpers/useTransactionFilters";
import {
  ORDER_DEVICE_TYPE_LABELS,
  ORDER_DEVICE_TYPES,
  ORDER_GATEWAY_LABELS,
  ORDER_GATEWAYS,
  ORDER_PAYMENT_MODE_GROUP_LABELS,
  ORDER_PAYMENT_MODES,
  ORDER_PLATFORM_LABELS,
  ORDER_PLATFORMS,
  paymentMethodLabel,
  type OrderClientDeviceType,
  type OrderGateway,
  type OrderPaymentModeGroup,
  type OrderPlatform,
} from "../helpers/orderAttribution";
import { NOT_CAPTURED, ORDER_PRODUCT_TYPE_LABELS, ORDER_PRODUCT_TYPES, type OrderProductType } from "../helpers/adminOrderFilters";
import { OrderStatusArrayValues } from "../helpers/schema";
import { ORDER_DISCOUNT_METHOD_LABELS } from "../helpers/orderDiscountMethod";
import type { OutputType as Facets, FacetOption } from "../endpoints/admin/orders/facets_GET.schema";
import styles from "./AdminTransactionsFilters.module.css";

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const FIELD_LABELS: Record<ListKey, string> = {
  status: "Status",
  platform: "Platform",
  os: "OS",
  browser: "Browser",
  device: "Device type",
  brand: "Device brand",
  method: "Payment method",
  mode: "Payment mode",
  gateway: "Gateway",
  product: "Product",
  teacher: "Teacher",
  promo: "Promo code",
};

/** The browsers an admin asks about most come first, whether or not orders used them yet. */
const PRIMARY_BROWSERS = ["Chrome", "Safari", "Edge", "Firefox", "Samsung Internet", "Opera"];
const PRIMARY_OS = ["Android", "iOS", "iPadOS", "Windows", "macOS", "Linux", "ChromeOS"];
const PRIMARY_BRANDS = ["Apple", "Samsung", "OnePlus", "Xiaomi", "Vivo", "Oppo", "Realme", "Motorola", "Google"];

function facetOptions(facet: FacetOption[] | undefined, primary: string[], noneLabel: string): FacetSelectOption[] {
  const counts = new Map((facet ?? []).map((f) => [f.value ?? NOT_CAPTURED, f.count]));
  const seen = new Set<string>();
  const options: FacetSelectOption[] = [];
  for (const value of primary) {
    seen.add(value);
    options.push({ value, label: value, count: counts.get(value) ?? 0 });
  }
  for (const f of facet ?? []) {
    if (f.value === null || seen.has(f.value)) continue;
    seen.add(f.value);
    options.push({ value: f.value, label: f.value, count: f.count });
  }
  options.push({ value: NOT_CAPTURED, label: noneLabel, count: counts.get(NOT_CAPTURED) ?? 0 });
  return options;
}

export function filterValueLabeler(facets: Facets | undefined) {
  return (key: ListKey, value: string): string => {
    switch (key) {
      case "status":
        return STATUS_LABELS[value] ?? value;
      case "platform":
        return ORDER_PLATFORM_LABELS[value as OrderPlatform] ?? value;
      case "device":
        return ORDER_DEVICE_TYPE_LABELS[value as OrderClientDeviceType] ?? value;
      case "mode":
        return ORDER_PAYMENT_MODE_GROUP_LABELS[value as OrderPaymentModeGroup] ?? value;
      case "gateway":
        return ORDER_GATEWAY_LABELS[value as OrderGateway] ?? value;
      case "product":
        return ORDER_PRODUCT_TYPE_LABELS[value as OrderProductType] ?? value;
      case "method":
        return value === NOT_CAPTURED ? "Not recorded" : paymentMethodLabel(value);
      case "teacher":
        return facets?.teachers.find((t) => String(t.id) === value)?.name ?? `Teacher #${value}`;
      default:
        return value === NOT_CAPTURED ? "Not captured" : value;
    }
  };
}

const Field: React.FC<{ label: string; htmlFor?: string; className?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  className,
  children,
}) => (
  <div className={`${styles.field} ${className ?? ""}`}>
    <label className={styles.fieldLabel} htmlFor={htmlFor}>
      {label}
    </label>
    {children}
  </div>
);

const AmountInputs: React.FC<{ api: TransactionFiltersApi }> = ({ api }) => {
  const min = useDebouncedInput(api.state.amountMin?.toString() ?? "", (value) => api.update({ min: value || null }), 500);
  const max = useDebouncedInput(api.state.amountMax?.toString() ?? "", (value) => api.update({ max: value || null }), 500);
  return (
    <div className={styles.pair}>
      <Input
        id="tx-amount-min"
        type="number"
        inputMode="decimal"
        min={0}
        placeholder="Min ₹"
        aria-label="Minimum amount"
        value={min.value}
        onChange={(e) => min.onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && min.flush()}
      />
      <span className={styles.pairDash} aria-hidden="true">
        -
      </span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        placeholder="Max ₹"
        aria-label="Maximum amount"
        value={max.value}
        onChange={(e) => max.onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && max.flush()}
      />
    </div>
  );
};

interface AdminTransactionsFiltersProps {
  api: TransactionFiltersApi;
  facets: Facets | undefined;
}

export const AdminTransactionsFilters: React.FC<AdminTransactionsFiltersProps> = ({ api, facets }) => {
  const { state, update, setList, clearAll, advancedCount, hasAnyFilter } = api;
  const [advancedOpen, setAdvancedOpen] = useState(advancedCount > 0);
  const valueLabel = filterValueLabeler(facets);

  useEffect(() => {
    if (advancedCount > 0) setAdvancedOpen(true);
  }, [advancedCount]);

  const search = useDebouncedInput(state.search, (value) => update({ q: value || null }));

  const platformOptions: FacetSelectOption[] = ORDER_PLATFORMS.map((p) => ({
    value: p,
    label: ORDER_PLATFORM_LABELS[p],
    icon: <OrderPlatformIcon platform={p} />,
  }));

  const listSelect = (key: ListKey, options: FacetSelectOption[], extra?: { searchable?: boolean; allLabel?: string }) => (
    <AdminFacetSelect
      id={`tx-filter-${key}`}
      label={FIELD_LABELS[key]}
      options={options}
      selected={state.lists[key]}
      onChange={(values) => setList(key, values)}
      {...extra}
    />
  );

  const chips: { id: string; label: string; onRemove: () => void }[] = [];
  if (state.search) chips.push({ id: "q", label: `Search: ${state.search}`, onRemove: () => update({ q: null }) });
  if (state.staleOnly) {
    chips.push({ id: "stale", label: "Pending over an hour", onRemove: () => update({ filter: null }) });
  }
  if (state.range !== "all") {
    const label =
      state.range === "custom"
        ? `Date: ${state.from ?? "start"} to ${state.to ?? "today"}`
        : `Date: ${DATE_RANGE_LABELS[state.range]}`;
    chips.push({ id: "range", label, onRemove: () => update({ range: null, from: null, to: null }) });
  }
  for (const key of Object.keys(FIELD_LABELS) as ListKey[]) {
    for (const value of state.lists[key]) {
      chips.push({
        id: `${key}:${value}`,
        label: `${FIELD_LABELS[key]}: ${valueLabel(key, value)}`,
        onRemove: () => setList(key, state.lists[key].filter((v) => v !== value)),
      });
    }
  }
  if (state.discount) {
    chips.push({
      id: "discount",
      label: `Discount: ${state.discount === "none" ? "None" : ORDER_DISCOUNT_METHOD_LABELS[state.discount]}`,
      onRemove: () => update({ discount: null }),
    });
  }
  if (state.amountMin !== undefined || state.amountMax !== undefined) {
    const label =
      state.amountMin !== undefined && state.amountMax !== undefined
        ? `Amount: ₹${state.amountMin} to ₹${state.amountMax}`
        : state.amountMin !== undefined
          ? `Amount: at least ₹${state.amountMin}`
          : `Amount: up to ₹${state.amountMax}`;
    chips.push({ id: "amount", label, onRemove: () => update({ min: null, max: null }) });
  }
  if (state.paidFrom || state.paidTo) {
    chips.push({
      id: "paid",
      label: `Paid: ${state.paidFrom ?? "start"} to ${state.paidTo ?? "today"}`,
      onRemove: () => update({ paidFrom: null, paidTo: null }),
    });
  }

  return (
    <section className={styles.card} aria-label="Transaction filters">
      <div className={styles.mainRow}>
        <Field label="Search" htmlFor="tx-search" className={styles.searchField}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <Input
              id="tx-search"
              type="search"
              placeholder="Order ID, student, email, phone, promo or IP"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search.flush();
              }}
              className={styles.searchInput}
            />
          </div>
        </Field>

        <Field label="Status" htmlFor="tx-filter-status">
          {listSelect(
            "status",
            OrderStatusArrayValues.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })),
            { allLabel: "All statuses" }
          )}
        </Field>

        <Field label="Date" htmlFor="tx-range">
          <Select
            value={state.range}
            onValueChange={(value) =>
              update(
                value === "custom"
                  ? { range: "custom" }
                  : { range: value === "all" ? null : value, from: null, to: null }
              )
            }
          >
            <SelectTrigger id="tx-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range} value={range}>
                  {DATE_RANGE_LABELS[range as DateRangePreset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Platform" htmlFor="tx-filter-platform">
          {listSelect("platform", platformOptions, { allLabel: "All platforms", searchable: false })}
        </Field>

        <div className={styles.advancedToggleWrap}>
          <button
            type="button"
            className={`${styles.advancedToggle} ${advancedOpen ? styles.advancedToggleOpen : ""}`}
            aria-expanded={advancedOpen}
            aria-controls="tx-advanced"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Advanced
            {advancedCount > 0 && <span className={styles.toggleCount}>{advancedCount}</span>}
            <ChevronDown size={16} className={styles.toggleChevron} aria-hidden="true" />
          </button>
        </div>
      </div>

      {state.range === "custom" && (
        <div className={styles.customRange}>
          <Field label="From" htmlFor="tx-from">
            <Input
              id="tx-from"
              type="date"
              value={state.from ?? ""}
              max={state.to ?? undefined}
              onChange={(e) => update({ range: "custom", from: e.target.value || null })}
            />
          </Field>
          <Field label="To" htmlFor="tx-to">
            <Input
              id="tx-to"
              type="date"
              value={state.to ?? ""}
              min={state.from ?? undefined}
              onChange={(e) => update({ range: "custom", to: e.target.value || null })}
            />
          </Field>
        </div>
      )}

      {advancedOpen && (
        <div id="tx-advanced" className={styles.advanced}>
          <fieldset className={styles.group}>
            <legend className={styles.groupTitle}>Payment</legend>
            <div className={styles.groupGrid}>
              <Field label="Payment method" htmlFor="tx-filter-method">
                {listSelect(
                  "method",
                  [
                    ...["payu", "wallet", "free", "teacher_sponsored"].map((m) => ({
                      value: m,
                      label: paymentMethodLabel(m),
                      count: facets?.paymentMethods.find((f) => f.value === m)?.count,
                    })),
                    ...(facets?.paymentMethods ?? [])
                      .filter((f) => f.value && !["payu", "wallet", "free", "teacher_sponsored"].includes(f.value))
                      .map((f) => ({ value: f.value as string, label: paymentMethodLabel(f.value), count: f.count })),
                    {
                      value: NOT_CAPTURED,
                      label: "Not recorded",
                      count: facets?.paymentMethods.find((f) => f.value === null)?.count,
                    },
                  ],
                  { searchable: false }
                )}
              </Field>
              <Field label="Payment mode" htmlFor="tx-filter-mode">
                {listSelect(
                  "mode",
                  ORDER_PAYMENT_MODES.map((m) => ({ value: m, label: ORDER_PAYMENT_MODE_GROUP_LABELS[m] })),
                  { searchable: false }
                )}
              </Field>
              <Field label="Gateway" htmlFor="tx-filter-gateway">
                {listSelect(
                  "gateway",
                  ORDER_GATEWAYS.map((g) => ({ value: g, label: ORDER_GATEWAY_LABELS[g] })),
                  { searchable: false }
                )}
              </Field>
              <Field label="Amount" htmlFor="tx-amount-min">
                <AmountInputs api={api} />
              </Field>
              <Field label="Promo code" htmlFor="tx-filter-promo">
                {listSelect(
                  "promo",
                  (facets?.promoCodes ?? []).map((p) => ({ value: p.code, label: p.code, count: p.count })),
                  { searchable: true }
                )}
              </Field>
              <Field label="Discount method" htmlFor="tx-discount">
                <Select
                  value={state.discount ?? "any"}
                  onValueChange={(value) => update({ discount: value === "any" ? null : value })}
                >
                  <SelectTrigger id="tx-discount">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="promo_code">Promo code</SelectItem>
                    <SelectItem value="tcoins">Tcoins used</SelectItem>
                    <SelectItem value="none">No discount</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Payment completed" htmlFor="tx-paid-from" className={styles.wide}>
                <div className={styles.pair}>
                  <Input
                    id="tx-paid-from"
                    type="date"
                    aria-label="Payment completed from"
                    value={state.paidFrom ?? ""}
                    max={state.paidTo ?? undefined}
                    onChange={(e) => update({ paidFrom: e.target.value || null })}
                  />
                  <span className={styles.pairDash} aria-hidden="true">
                    -
                  </span>
                  <Input
                    type="date"
                    aria-label="Payment completed to"
                    value={state.paidTo ?? ""}
                    min={state.paidFrom ?? undefined}
                    onChange={(e) => update({ paidTo: e.target.value || null })}
                  />
                </div>
              </Field>
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.groupTitle}>Source and device</legend>
            <div className={styles.groupGrid}>
              <Field label="Operating system" htmlFor="tx-filter-os">
                {listSelect("os", facetOptions(facets?.osNames, PRIMARY_OS, "Not captured"))}
              </Field>
              <Field label="Browser" htmlFor="tx-filter-browser">
                {listSelect("browser", facetOptions(facets?.browsers, PRIMARY_BROWSERS, "Not captured or app"))}
              </Field>
              <Field label="Device type" htmlFor="tx-filter-device">
                {listSelect(
                  "device",
                  ORDER_DEVICE_TYPES.map((d) => ({ value: d, label: ORDER_DEVICE_TYPE_LABELS[d] })),
                  { searchable: false }
                )}
              </Field>
              <Field label="Device brand" htmlFor="tx-filter-brand">
                {listSelect("brand", facetOptions(facets?.brands, PRIMARY_BRANDS, "Not captured"))}
              </Field>
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.groupTitle}>Product</legend>
            <div className={styles.groupGrid}>
              <Field label="Product type" htmlFor="tx-filter-product">
                {listSelect(
                  "product",
                  ORDER_PRODUCT_TYPES.map((p) => ({ value: p, label: ORDER_PRODUCT_TYPE_LABELS[p] })),
                  { searchable: false }
                )}
              </Field>
              <Field label="Teacher" htmlFor="tx-filter-teacher">
                {listSelect(
                  "teacher",
                  (facets?.teachers ?? []).map((t) => ({ value: String(t.id), label: t.name, count: t.count })),
                  { searchable: true }
                )}
              </Field>
            </div>
          </fieldset>
        </div>
      )}

      {chips.length > 0 && (
        <div className={styles.chips} aria-label="Active filters">
          {chips.map((chip) => (
            <span key={chip.id} className={styles.chip}>
              <span className={styles.chipLabel} title={chip.label}>
                {chip.label}
              </span>
              <button type="button" className={styles.chipRemove} onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          {hasAnyFilter && (
            <button type="button" className={styles.clearAll} onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      )}
    </section>
  );
};
