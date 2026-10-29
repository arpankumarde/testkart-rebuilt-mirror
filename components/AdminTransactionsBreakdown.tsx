import React, { useMemo, useState } from "react";
import { AlertCircle, BarChart3, ChevronDown, Info, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { SegmentedControl } from "./SegmentedControl";
import { OrderPlatformIcon } from "./OrderPlatformBadge";
import { useAdminOrderSummary } from "../helpers/useAdminOrderSearch";
import { useAdminSubscriptionTransactions } from "../helpers/useAdminSubscriptionTransactions";
import { useTransactionFilters, type ListKey } from "../helpers/useTransactionFilters";
import {
  matchesSubscriptionFilters,
  useSubscriptionTxFilters,
  type SubListKey,
} from "../helpers/useSubscriptionTxFilters";
import { adminFormat } from "../helpers/adminFormat";
import { NOT_CAPTURED } from "../helpers/adminOrderFilters";
import {
  ORDER_DEVICE_TYPE_LABELS,
  ORDER_PLATFORM_LABELS,
  type OrderClientDeviceType,
  type OrderPlatform,
} from "../helpers/orderAttribution";
import type { OrderBreakdown } from "../endpoints/admin/orders/summary_POST.schema";
import styles from "./AdminTransactionsBreakdown.module.css";

/* Source capture started on this day; earlier payments carry no device data. */
const ATTRIBUTION_SINCE = "5 Nov 2026";

type Row = { key: string | null; label: string; orders: number; completed: number; revenue: number };

type Totals = { orders: number; revenue: number; attributed: number };

interface BreakdownBodyProps {
  dimension: string;
  options: { value: string; label: string }[];
  onDimensionChange: (value: string) => void;
  rows: Row[] | undefined;
  totals: Totals | undefined;
  isLoading: boolean;
  error: unknown;
  isPlatform: boolean;
  /** Returns the action that narrows the list to a row, or null when the row has no filter. */
  filterFor: (row: Row) => (() => void) | null;
  unitLabel: string;
}

const BreakdownBody: React.FC<BreakdownBodyProps> = ({
  dimension,
  options,
  onDimensionChange,
  rows,
  totals,
  isLoading,
  error,
  isPlatform,
  filterFor,
  unitLabel,
}) => {
  const maxOrders = Math.max(1, ...(rows ?? []).map((row) => row.orders));
  const columnLabel = options.find((o) => o.value === dimension)?.label ?? "";

  return (
    <>
      <div className={styles.segmentsWrap}>
        <SegmentedControl
          aria-label="Break down by"
          value={dimension}
          onValueChange={onDimensionChange}
          options={options}
          className={styles.segments}
        />
      </div>

      <div className={styles.body}>
        {error ? (
          <p className={styles.error} role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            Could not load the breakdown: {error instanceof Error ? error.message : "please try again"}
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{columnLabel}</th>
                <th scope="col" className={styles.barCol}>
                  <span className={styles.srOnly}>Share of {unitLabel}</span>
                </th>
                <th scope="col" className={styles.num}>Orders</th>
                <th scope="col" className={styles.num}>Successful</th>
                <th scope="col" className={styles.num}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !rows
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} aria-hidden="true">
                      <td colSpan={5}>
                        <Skeleton style={{ height: "1rem", width: "100%" }} />
                      </td>
                    </tr>
                  ))
                : rows?.map((row) => {
                    const apply = filterFor(row);
                    const label = (
                      <>
                        {isPlatform && row.key && <OrderPlatformIcon platform={row.key as OrderPlatform} />}
                        <span className={styles.rowLabelText}>{row.label}</span>
                      </>
                    );
                    return (
                      <tr key={row.key ?? "none"}>
                        <td className={styles.rowLabel}>
                          {apply ? (
                            <button type="button" className={styles.rowButton} onClick={apply} title={`Show only ${row.label}`}>
                              {label}
                            </button>
                          ) : (
                            <span className={styles.rowStatic}>{label}</span>
                          )}
                        </td>
                        <td className={styles.barCol}>
                          <span className={styles.barTrack} aria-hidden="true">
                            <span className={styles.bar} style={{ width: `${(row.orders / maxOrders) * 100}%` }} />
                          </span>
                        </td>
                        <td className={styles.num}>{adminFormat.count(row.orders)}</td>
                        <td className={styles.num}>{adminFormat.count(row.completed)}</td>
                        <td className={styles.num}>{adminFormat.inr(row.revenue)}</td>
                      </tr>
                    );
                  })}
              {rows && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No {unitLabel} match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.footer}>
        {totals ? (
          <p className={styles.totals}>
            <strong>{adminFormat.count(totals.orders)}</strong> {unitLabel} matching the current filters,{" "}
            <strong>{adminFormat.inr(totals.revenue)}</strong> collected
          </p>
        ) : (
          <Skeleton style={{ height: "0.875rem", width: "16rem" }} />
        )}
        {totals && totals.attributed < totals.orders && (
          <p className={styles.footnote}>
            <Info size={14} aria-hidden="true" />
            Source and device are captured for {adminFormat.count(totals.attributed)} of {adminFormat.count(totals.orders)}.
            Payments before {ATTRIBUTION_SINCE} show as Not captured.
          </p>
        )}
      </div>
    </>
  );
};

const STUDENT_OPTIONS: { value: OrderBreakdown; label: string }[] = [
  { value: "platform", label: "Platform" },
  { value: "os", label: "OS" },
  { value: "browser", label: "Browser" },
  { value: "brand", label: "Brand" },
  { value: "paymentMode", label: "Payment method" },
  { value: "teacher", label: "Teacher" },
  { value: "product", label: "Product" },
];

const STUDENT_FILTER: Record<Exclude<OrderBreakdown, "paymentMode">, ListKey> = {
  platform: "platform",
  os: "os",
  browser: "browser",
  brand: "brand",
  teacher: "teacher",
  product: "product",
};

const StudentBreakdown: React.FC = () => {
  const api = useTransactionFilters();
  const [dimension, setDimension] = useState<OrderBreakdown>("platform");
  const { data, isPending, error } = useAdminOrderSummary(api.filters, dimension);

  const add = (key: ListKey, value: string) => {
    if (!api.state.lists[key].includes(value)) api.setList(key, [...api.state.lists[key], value]);
  };

  const filterFor = (row: Row): (() => void) | null => {
    if (dimension === "paymentMode") {
      if (!row.key) return null;
      const [kind, value] = row.key.split(":");
      if (kind === "mode") {
        return () =>
          api.update({
            mode: [...new Set([...api.state.lists.mode, value])].join(","),
            gateway: value === "unknown" ? "payu" : api.state.lists.gateway.join(",") || null,
          });
      }
      return () => add("method", value);
    }
    const value = row.key ?? (dimension === "os" || dimension === "browser" || dimension === "brand" ? NOT_CAPTURED : null);
    if (value === null) return null;
    return () => add(STUDENT_FILTER[dimension], value);
  };

  return (
    <BreakdownBody
      dimension={dimension}
      options={STUDENT_OPTIONS}
      onDimensionChange={(value) => setDimension(value as OrderBreakdown)}
      rows={data?.breakdown === dimension ? data.rows : undefined}
      totals={data ? { orders: data.totals.orders, revenue: data.totals.revenue, attributed: data.totals.attributed } : undefined}
      isLoading={isPending || data?.breakdown !== dimension}
      error={error}
      isPlatform={dimension === "platform"}
      filterFor={filterFor}
      unitLabel="student payments"
    />
  );
};

type SubDimension = "platform" | "os" | "browser" | "brand" | "device" | "paymentMethod" | "plan";

const SUB_OPTIONS: { value: SubDimension; label: string }[] = [
  { value: "platform", label: "Platform" },
  { value: "os", label: "OS" },
  { value: "browser", label: "Browser" },
  { value: "brand", label: "Brand" },
  { value: "device", label: "Device type" },
  { value: "paymentMethod", label: "Payment method" },
  { value: "plan", label: "Plan" },
];

const SUB_FILTER: Partial<Record<SubDimension, SubListKey>> = {
  platform: "splatform",
  os: "sos",
  browser: "sbrowser",
  brand: "sbrand",
  device: "sdevice",
  plan: "splan",
};

const SUB_METHOD_LABELS: Record<string, string> = {
  payu: "PayU, one-time",
  payu_recurring: "PayU autopay",
  wallet: "Testkart wallet",
};

const SubscriptionBreakdown: React.FC = () => {
  const { data, isPending, error } = useAdminSubscriptionTransactions();
  const api = useSubscriptionTxFilters();
  const [dimension, setDimension] = useState<SubDimension>("platform");

  const matching = useMemo(() => (data ?? []).filter((t) => matchesSubscriptionFilters(t, api.state)), [data, api.state]);

  const rows = useMemo<Row[] | undefined>(() => {
    if (!data) return undefined;
    const groups = new Map<string | null, Row>();
    for (const t of matching) {
      let key: string | null;
      let label: string;
      switch (dimension) {
        case "platform":
          key = t.client?.platform ?? "unknown";
          label = ORDER_PLATFORM_LABELS[key as OrderPlatform];
          break;
        case "os":
          key = t.client?.osName ?? null;
          label = key ?? "Not captured";
          break;
        case "browser":
          key = t.client?.browserName ?? null;
          label = key ?? "Not captured";
          break;
        case "brand":
          key = t.client?.deviceBrand ?? null;
          label = key ?? "Not captured";
          break;
        case "device":
          key = t.client?.deviceType ?? "unknown";
          label = ORDER_DEVICE_TYPE_LABELS[key as OrderClientDeviceType];
          break;
        case "paymentMethod":
          key = t.paymentMethod;
          label = key ? SUB_METHOD_LABELS[key] ?? key : "Not recorded";
          break;
        default:
          key = t.planName;
          label = t.planName;
      }
      const row = groups.get(key) ?? { key, label, orders: 0, completed: 0, revenue: 0 };
      row.orders += 1;
      if (t.status === "completed") {
        row.completed += 1;
        row.revenue += t.amount;
      }
      groups.set(key, row);
    }
    return [...groups.values()].sort((a, b) => b.orders - a.orders || a.label.localeCompare(b.label)).slice(0, 12);
  }, [data, matching, dimension]);

  const totals = data
    ? {
        orders: matching.length,
        revenue: matching.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.amount, 0),
        attributed: matching.filter((t) => t.client).length,
      }
    : undefined;

  const filterFor = (row: Row): (() => void) | null => {
    const key = SUB_FILTER[dimension];
    if (!key) return null;
    const value = row.key ?? NOT_CAPTURED;
    return () => {
      if (!api.state.lists[key].includes(value)) api.setList(key, [...api.state.lists[key], value]);
    };
  };

  return (
    <BreakdownBody
      dimension={dimension}
      options={SUB_OPTIONS}
      onDimensionChange={(value) => setDimension(value as SubDimension)}
      rows={rows}
      totals={totals}
      isLoading={isPending}
      error={error}
      isPlatform={dimension === "platform"}
      filterFor={filterFor}
      unitLabel="subscription payments"
    />
  );
};

interface AdminTransactionsBreakdownProps {
  scope: "student" | "subscription";
}

/**
 * The Breakdown button for the Transactions page header. Opens an anchored
 * popup with the breakdown for whichever ledger is open, under the filters
 * already applied. The button toggles it; Escape, a click outside or the
 * close button dismiss it.
 */
export const AdminTransactionsBreakdown: React.FC<AdminTransactionsBreakdownProps> = ({ scope }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-expanded={open} className={open ? styles.triggerOpen : undefined}>
          <BarChart3 size={16} aria-hidden="true" />
          Breakdown
          <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        removeBackgroundAndPadding
        className={styles.popup}
        aria-label={scope === "student" ? "Student payments breakdown" : "Subscription payments breakdown"}
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Breakdown</h2>
            <p className={styles.subtitle}>{scope === "student" ? "Student payments" : "Subscription payments"}, current filters</p>
          </div>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close breakdown">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {scope === "student" ? <StudentBreakdown /> : <SubscriptionBreakdown />}
      </PopoverContent>
    </Popover>
  );
};