import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { toast } from "sonner";
import { AlertCircle, Archive, Ban, ChevronDown, Download, FileSpreadsheet, Loader2, Receipt, RefreshCw, Search, X } from "lucide-react";
import { useAdminSubscriptionTransactions } from "../helpers/useAdminSubscriptionTransactions";
import type { SubscriptionTransactionItem } from "../endpoints/admin/subscription-transactions/list_GET.schema";
import { postReconcileSubscriptionTransaction } from "../endpoints/admin/subscription-transactions/reconcile_POST.schema";
import { postMarkSubscriptionTransactionFailed } from "../endpoints/admin/subscription-transactions/mark-failed_POST.schema";
import { getAdminSubscriptionTransactionInvoice } from "../endpoints/admin/subscription-transactions/invoice_GET.schema";
import { postAdminSubscriptionInvoiceZip } from "../endpoints/admin/subscription-transactions/invoice-zip_POST.schema";
import type { TransactionStatus } from "../helpers/schema";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import {
  matchesSubscriptionFilters,
  useSubscriptionTxFilters,
  type SubListKey,
} from "../helpers/useSubscriptionTxFilters";
import { NOT_CAPTURED } from "../helpers/adminOrderFilters";
import {
  ORDER_DEVICE_TYPE_LABELS,
  ORDER_DEVICE_TYPES,
  ORDER_PLATFORM_LABELS,
  ORDER_PLATFORMS,
  type OrderClientDeviceType,
  type OrderPlatform,
} from "../helpers/orderAttribution";
import { deviceLabel, deviceSummary, formatDateTime, formatInr, toCsvDateTime } from "../helpers/transactionDisplay";
import { SortableTh } from "./SortableTh";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { PaymentFailureReason } from "./PaymentFailureReason";
import { AdminFacetSelect, type FacetSelectOption } from "./AdminFacetSelect";
import { OrderPlatformBadge, OrderPlatformIcon } from "./OrderPlatformBadge";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "./Sheet";
import { ClientSourceSection, DetailSection, detailSheetClasses } from "./AdminTransactionDetailSheet";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./Pagination";
import styles from "./AdminSubscriptionTransactionsTable.module.css";

const PAGE_SIZE = 100;

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const SORT_ACCESSORS: SortAccessors<SubscriptionTransactionItem, "id" | "date" | "teacher" | "plan" | "amount" | "status"> = {
  id: (t) => t.id,
  date: (t) => (t.transactionDate ? new Date(t.transactionDate) : null),
  teacher: (t) => t.teacherName,
  plan: (t) => t.planName,
  amount: (t) => t.amount,
  status: (t) => t.status,
};

const STATUS_VARIANTS: Record<TransactionStatus, "success" | "warning" | "destructive" | "outline"> = {
  completed: "success",
  pending: "warning",
  failed: "destructive",
  refunded: "outline",
};

const METHOD_LABELS: Record<string, string> = {
  payu: "PayU",
  payu_recurring: "PayU autopay",
  wallet: "Testkart wallet",
};

const methodLabel = (method: string | null) => (method ? METHOD_LABELS[method] ?? method : "No method");

const FIELD_LABELS: Record<SubListKey, string> = {
  sstatus: "Status",
  splan: "Plan",
  splatform: "Platform",
  sos: "OS",
  sbrowser: "Browser",
  sdevice: "Device type",
  sbrand: "Device brand",
};

const TransactionStatusBadge: React.FC<{ status: TransactionStatus }> = ({ status }) => (
  <Badge variant={STATUS_VARIANTS[status]} className={styles.flag}>
    {sentenceCase(status)}
  </Badge>
);

const formatDay = (date: Date): string =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const formatTime = (date: Date): string =>
  new Date(date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const renderDate = (date: Date | null) =>
  date ? (
    <div className={styles.stack}>
      <span className={styles.valueLine}>{formatDay(date)}</span>
      <span className={styles.secondaryLine}>{formatTime(date)}</span>
    </div>
  ) : (
    <span className={styles.emptyLine}>Not recorded</span>
  );

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colTransaction} />
    <col className={styles.colDate} />
    <col />
    <col className={styles.colPlan} />
    <col className={styles.colSource} />
    <col className={styles.colAmount} />
    <col className={styles.colStatus} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const TableRowSkeleton: React.FC = () => (
  <tr>
    <td><StackSkeleton top="3rem" bottom="80%" /></td>
    <td><StackSkeleton top="5rem" bottom="3rem" /></td>
    <td><StackSkeleton top="60%" bottom="80%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "70%" }} /></td>
    <td><StackSkeleton top="5rem" bottom="80%" /></td>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} />
        <Skeleton style={{ height: "0.75rem", width: "2.5rem", marginLeft: "auto" }} />
      </div>
    </td>
    <td><Skeleton style={{ height: "1.125rem", width: "4.5rem" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "3.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const TransactionCardSkeleton: React.FC = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

/** Counted options for a facet, from the loaded rows, with Not captured last. */
function countedOptions(
  rows: SubscriptionTransactionItem[],
  value: (t: SubscriptionTransactionItem) => string | null | undefined,
  noneLabel: string
): FacetSelectOption[] {
  const counts = new Map<string, number>();
  for (const t of rows) {
    const v = value(t) ?? NOT_CAPTURED;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const options = [...counts.entries()]
    .filter(([v]) => v !== NOT_CAPTURED)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([v, count]) => ({ value: v, label: v, count }));
  options.push({ value: NOT_CAPTURED, label: noneLabel, count: counts.get(NOT_CAPTURED) ?? 0 });
  return options;
}

interface Props {
  className?: string;
}

export const AdminSubscriptionTransactionsTable: React.FC<Props> = ({ className }) => {
  const queryClient = useQueryClient();
  const { data: transactions, isPending, isError, error } = useAdminSubscriptionTransactions();
  const api = useSubscriptionTxFilters();
  const { state, update, setList, clearAll, hasAnyFilter } = api;
  const currentPage = state.page;

  const [reconcilingId, setReconcilingId] = useState<number | null>(null);
  const [markingFailedId, setMarkingFailedId] = useState<number | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [detail, setDetail] = useState<SubscriptionTransactionItem | null>(null);

  const search = useDebouncedInput(state.search, (value) => update({ sq: value || null }));

  const all = useMemo(() => transactions ?? [], [transactions]);
  const filteredTransactions = useMemo(() => all.filter((t) => matchesSubscriptionFilters(t, state)), [all, state]);

  useEffect(() => {
    if (!detail || !transactions) return;
    const fresh = transactions.find((t) => t.id === detail.id);
    if (fresh && fresh !== detail) setDetail(fresh);
  }, [transactions, detail]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "subscription-transactions"] });

  const reconcileMutation = useMutation({
    mutationFn: (transactionId: number) => postReconcileSubscriptionTransaction({ transactionId }),
    onMutate: (transactionId) => setReconcilingId(transactionId),
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.info(result.message);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Reconciliation failed"),
    onSettled: () => setReconcilingId(null),
  });

  const markFailedMutation = useMutation({
    mutationFn: (transactionId: number) => postMarkSubscriptionTransactionFailed({ transactionId }),
    onMutate: (transactionId) => setMarkingFailedId(transactionId),
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to mark transaction as failed"),
    onSettled: () => setMarkingFailedId(null),
  });

  /* The accountant's GST register: only invoiced transactions, in the existing layout. */
  const handleExportGst = () => {
    const eligible = filteredTransactions.filter((t) => t.status === "completed" && t.amount > 0 && !!t.invoiceNumber);
    if (eligible.length === 0) {
      toast.error("No invoiced transactions match the current filters.");
      return;
    }
    const dataRows = eligible.map((t, index) => {
      const total = t.amount;
      const baseAmount = total / 1.18;
      const igst = total - baseAmount;
      const date = new Date(t.transactionDate || Date.now());
      const formattedDate = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
      return [index + 1, formattedDate, t.invoiceNumber!, "", t.teacherName, t.planName, `  ${baseAmount.toFixed(2)} `, "18", "", "", `  ${igst.toFixed(2)} `, "", `  ${total.toFixed(2)} `];
    });
    const header1 =
      "S.No.,Date,Invoice No,Supplier GSTIN number,Teacher Name,Plan,Invoice Base Amount (Rs.),Rate of tax (%),GST,,,Exempted/Nill rated sales (Rs.)  ,Invoice Total (Rs.)\n";
    const header2 = ",,,,,,,SGST (Rs.),CGST (Rs.),IGST (Rs.),,\n";
    const csv = header1 + header2 + Papa.unparse(dataRows, { header: false });
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "GST_Subscription_Report.csv");
  };

  const handleExportTransactions = () => {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions match the current filters.");
      return;
    }
    const csv = Papa.unparse(
      filteredTransactions.map((t) => ({
        "Transaction ID": t.id,
        "Gateway transaction ID": t.transactionId ?? "",
        Date: toCsvDateTime(t.transactionDate),
        Status: sentenceCase(t.status),
        Teacher: t.teacherName,
        Email: t.teacherEmail ?? "",
        Plan: t.planName,
        "Amount (Rs.)": t.amount.toFixed(2),
        "Payment method": methodLabel(t.paymentMethod),
        "Invoice number": t.invoiceNumber ?? "",
        Platform: t.client ? ORDER_PLATFORM_LABELS[t.client.platform] : "Not captured",
        "Source copied from": t.clientInheritedFrom ? `#${t.clientInheritedFrom}` : "",
        OS: t.client?.osName ?? "",
        "OS version": t.client?.osVersion ?? "",
        "Device type": t.client ? ORDER_DEVICE_TYPE_LABELS[t.client.deviceType] : "",
        Device: t.client ? deviceLabel(t.client) : "",
        "Device brand": t.client?.deviceBrand ?? "",
        "Device model": t.client?.deviceModel ?? "",
        Browser: t.client?.browserName ?? "",
        "Browser version": t.client?.browserVersion ?? "",
        "App version": t.client?.appVersion ?? "",
        Screen: t.client?.screen ?? "",
        Source: t.client?.referrer ?? "",
        "IP address": t.client?.ip ?? "",
        "User agent": t.client?.userAgent ?? "",
      }))
    );
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "Subscription_Transactions.csv");
    toast.success(`Exported ${filteredTransactions.length.toLocaleString("en-IN")} transactions`);
  };

  const handleDownloadAllInvoicesZip = async () => {
    const eligibleIds = filteredTransactions
      .filter((t) => t.status === "completed" && t.amount > 0 && !!t.invoiceNumber)
      .map((t) => t.id);
    if (eligibleIds.length === 0) {
      toast.error("No invoiced transactions match the current filters.");
      return;
    }
    try {
      setIsDownloadingZip(true);
      const blob = await postAdminSubscriptionInvoiceZip({ transactionIds: eligibleIds });
      downloadBlob(blob, "subscription-invoices.zip");
      toast.success(`Downloaded ${eligibleIds.length} invoices`);
    } catch (err) {
      console.error("Failed to download invoices zip:", err);
      toast.error(err instanceof Error ? err.message : "Failed to download invoices");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadInvoice = async (transactionId: number) => {
    try {
      setDownloadingInvoiceId(transactionId);
      const blob = await getAdminSubscriptionTransactionInvoice({ transactionId });
      downloadBlob(blob, `invoice-subscription-${transactionId}.pdf`);
      toast.success("Invoice downloaded successfully");
    } catch (err) {
      console.error("Failed to download invoice:", err);
      toast.error(err instanceof Error ? err.message : "Failed to download invoice");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const { sorted: sortedTransactions, ...sortState } = useTableSort(filteredTransactions, SORT_ACCESSORS);
  const sort = {
    ...sortState,
    toggleSort: (column: Parameters<typeof sortState.toggleSort>[0]) => {
      sortState.toggleSort(column);
      update({ spage: null }, true);
    },
  };

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedTransactions.slice(start, start + PAGE_SIZE);
  }, [sortedTransactions, currentPage]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    update({ spage: page === 1 ? null : page }, true);
  };

  const options: Record<SubListKey, FacetSelectOption[]> = {
    sstatus: (["completed", "pending", "failed", "refunded"] as const).map((s) => ({
      value: s,
      label: sentenceCase(s),
      count: all.filter((t) => t.status === s).length,
    })),
    splan: [...new Set(all.map((t) => t.planName))].sort().map((p) => ({ value: p, label: p, count: all.filter((t) => t.planName === p).length })),
    splatform: ORDER_PLATFORMS.map((p) => ({
      value: p,
      label: ORDER_PLATFORM_LABELS[p],
      icon: <OrderPlatformIcon platform={p} />,
      count: all.filter((t) => (t.client?.platform ?? "unknown") === p).length,
    })),
    sos: countedOptions(all, (t) => t.client?.osName, "Not captured"),
    sbrowser: countedOptions(all, (t) => t.client?.browserName, "Not captured or app"),
    sdevice: ORDER_DEVICE_TYPES.map((d) => ({
      value: d,
      label: ORDER_DEVICE_TYPE_LABELS[d],
      count: all.filter((t) => (t.client?.deviceType ?? "unknown") === d).length,
    })),
    sbrand: countedOptions(all, (t) => t.client?.deviceBrand, "Not captured"),
  };

  const valueLabel = (key: SubListKey, value: string) => {
    if (key === "splatform") return ORDER_PLATFORM_LABELS[value as OrderPlatform] ?? value;
    if (key === "sdevice") return ORDER_DEVICE_TYPE_LABELS[value as OrderClientDeviceType] ?? value;
    if (key === "sstatus") return sentenceCase(value);
    return value === NOT_CAPTURED ? "Not captured" : value;
  };

  const chips: { id: string; label: string; onRemove: () => void }[] = [];
  if (state.search) chips.push({ id: "sq", label: `Search: ${state.search}`, onRemove: () => update({ sq: null }) });
  for (const key of Object.keys(FIELD_LABELS) as SubListKey[]) {
    for (const value of state.lists[key]) {
      chips.push({
        id: `${key}:${value}`,
        label: `${FIELD_LABELS[key]}: ${valueLabel(key, value)}`,
        onRemove: () => setList(key, state.lists[key].filter((v) => v !== value)),
      });
    }
  }

  const facet = (key: SubListKey, allLabel = "All") => (
    <AdminFacetSelect
      id={`stx-filter-${key}`}
      label={FIELD_LABELS[key]}
      options={options[key]}
      selected={state.lists[key]}
      onChange={(values) => setList(key, values)}
      allLabel={allLabel}
      searchable={key === "splan" || key === "sos" || key === "sbrowser" || key === "sbrand" ? undefined : false}
    />
  );

  const renderActions = (t: SubscriptionTransactionItem, withLabels = false) => {
    const action = (key: string, label: string, icon: React.ReactNode, onClick: () => void, disabled: boolean, danger = false) =>
      withLabels ? (
        <Button key={key} variant="outline" size="sm" onClick={onClick} disabled={disabled} className={danger ? styles.dangerButton : undefined}>
          {icon}
          {label}
        </Button>
      ) : (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${danger ? styles.iconButtonDanger : ""}`}
              aria-label={`${label} for transaction #${t.id}`}
              onClick={onClick}
              disabled={disabled}
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      );
    const spinner = <Loader2 className={styles.spinner} />;
    const items: React.ReactNode[] = [];
    if (t.status === "completed" && t.amount > 0) {
      items.push(action("invoice", "Download invoice", downloadingInvoiceId === t.id ? spinner : <Download />, () => handleDownloadInvoice(t.id), downloadingInvoiceId === t.id));
    }
    if (t.status === "pending" && t.transactionId) {
      const busy = reconcilingId === t.id || markingFailedId === t.id;
      items.push(
        action("reconcile", "Reconcile transaction", reconcilingId === t.id ? spinner : <RefreshCw />, () => reconcileMutation.mutate(t.id), busy),
        action("fail", "Mark as failed", markingFailedId === t.id ? spinner : <Ban />, () => markFailedMutation.mutate(t.id), busy, true)
      );
    }
    return <div className={styles.rowActions}>{items}</div>;
  };

  const renderSource = (t: SubscriptionTransactionItem) => (
    <div className={styles.stack}>
      <OrderPlatformBadge platform={t.client?.platform ?? "unknown"} className={styles.platformBadge} />
      {t.client && (
        <span className={styles.secondaryLine} title={t.clientInheritedFrom ? `${deviceSummary(t.client)}, from the sign-up #${t.clientInheritedFrom}` : deviceSummary(t.client)}>
          {deviceSummary(t.client)}
        </span>
      )}
    </div>
  );

  const openFromRow = (event: React.MouseEvent<HTMLTableRowElement>, t: SubscriptionTransactionItem) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, [role='dialog']")) return;
    if (window.getSelection()?.toString()) return;
    setDetail(t);
  };

  const renderContent = () => {
    if (isPending) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => (
              <TransactionCardSkeleton key={i} />
            ))}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Failed to load subscription transactions"
          description={error instanceof Error ? error.message : "Please try again later."}
        />
      );
    }

    if (all.length === 0) {
      return <ConsoleListEmpty icon={<Receipt size={24} />} title="No subscription transactions found" />;
    }

    if (filteredTransactions.length === 0) {
      return (
        <ConsoleListEmpty icon={<Receipt size={24} />} title="No transactions match your filters" description="Remove a filter to see more." />
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="id" sort={sort}>Transaction</SortableTh>
                <SortableTh column="date" sort={sort}>Date</SortableTh>
                <SortableTh column="teacher" sort={sort}>Teacher</SortableTh>
                <SortableTh column="plan" sort={sort}>Plan</SortableTh>
                <th>Source</th>
                <SortableTh column="amount" sort={sort} className={styles.num}>Amount</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((t) => (
                <tr key={t.id} className={styles.clickableRow} onClick={(e) => openFromRow(e, t)}>
                  <td>
                    <div className={styles.stack}>
                      <button type="button" className={styles.idButton} onClick={() => setDetail(t)} aria-label={`Open details for transaction #${t.id}`}>
                        #{t.id}
                      </button>
                      <span className={styles.secondaryLine} title={t.transactionId || undefined}>
                        {t.transactionId || "No transaction ID"}
                      </span>
                    </div>
                  </td>
                  <td>{renderDate(t.transactionDate)}</td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryLine}>
                        <span className={styles.truncate} title={t.teacherName}>{t.teacherName}</span>
                      </span>
                      <span className={styles.secondaryLine} title={t.teacherEmail || undefined}>
                        {t.teacherEmail || "No email"}
                      </span>
                    </div>
                  </td>
                  <td title={t.planName}>{t.planName}</td>
                  <td>{renderSource(t)}</td>
                  <td className={styles.num}>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{formatInr(t.amount)}</span>
                      <span className={styles.secondaryLine}>{methodLabel(t.paymentMethod)}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.statusCell}>
                      <TransactionStatusBadge status={t.status} />
                      {t.paymentFailure && <PaymentFailureReason failure={t.paymentFailure} />}
                    </div>
                  </td>
                  <td>{renderActions(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {paginatedTransactions.map((t) => (
            <article key={t.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  <span className={styles.primaryLine}>
                    <span className={styles.truncate} title={t.teacherName}>{t.teacherName}</span>
                    <TransactionStatusBadge status={t.status} />
                  </span>
                  <span className={styles.secondaryLine} title={t.teacherEmail || undefined}>
                    {t.teacherEmail || "No email"}
                  </span>
                </div>
                {renderActions(t)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}><dt>Transaction</dt><dd>#{t.id}</dd></div>
                <div className={styles.cardStat}><dt>Plan</dt><dd>{t.planName}</dd></div>
                <div className={styles.cardStat}><dt>Amount</dt><dd>{formatInr(t.amount)}</dd></div>
                <div className={styles.cardStat}><dt>Method</dt><dd>{methodLabel(t.paymentMethod)}</dd></div>
                <div className={styles.cardStat}>
                  <dt>Date</dt>
                  <dd>{t.transactionDate ? `${formatDay(t.transactionDate)}, ${formatTime(t.transactionDate)}` : "Not recorded"}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Source</dt>
                  <dd>{t.client ? ORDER_PLATFORM_LABELS[t.client.platform] : "Not captured"}</dd>
                </div>
                {t.client && (
                  <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                    <dt>Device</dt>
                    <dd>{deviceSummary(t.client)}</dd>
                  </div>
                )}
                {t.paymentFailure && (
                  <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                    <dt>Reason</dt>
                    <dd><PaymentFailureReason failure={t.paymentFailure} variant="card" /></dd>
                  </div>
                )}
              </dl>
              <Button variant="outline" size="sm" onClick={() => setDetail(t)} className={styles.cardDetails}>
                View details
              </Button>
            </article>
          ))}
        </div>
      </>
    );
  };

  const filteredCount = filteredTransactions.length;
  const startItem = filteredCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const endItem = Math.min(currentPage * PAGE_SIZE, filteredCount);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) pages.push(i);
      else if (pages[pages.length - 1] !== "...") pages.push("...");
    }
    return (
      <div className={styles.paginationWrapper}>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  goToPage(currentPage - 1);
                }}
                className={currentPage === 1 ? styles.disabledPagination : ""}
              />
            </PaginationItem>
            {pages.map((p, i) => (
              <PaginationItem key={i}>
                {p === "..." ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href="#"
                    isActive={p === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(p);
                    }}
                  >
                    {p}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  goToPage(currentPage + 1);
                }}
                className={currentPage === totalPages ? styles.disabledPagination : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <section className={styles.filterCard} aria-label="Subscription payment filters">
        <div className={styles.filterGrid}>
          <div className={`${styles.field} ${styles.searchField}`}>
            <label className={styles.fieldLabel} htmlFor="stx-search">
              Search
            </label>
            <div className={styles.searchWrapper}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <Input
                id="stx-search"
                type="search"
                placeholder="Teacher, email or transaction ID"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") search.flush();
                }}
                className={styles.searchInput}
              />
            </div>
          </div>
          {(["sstatus", "splan", "splatform", "sos", "sbrowser", "sdevice", "sbrand"] as const).map((key) => (
            <div key={key} className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`stx-filter-${key}`}>
                {key === "sos" ? "Operating system" : FIELD_LABELS[key]}
              </label>
              {facet(key, key === "sstatus" ? "All statuses" : key === "splan" ? "All plans" : key === "splatform" ? "All platforms" : "All")}
            </div>
          ))}
        </div>

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

      {!isPending && all.length > 0 && (
        <div className={styles.resultsCount}>
          <p>
            Showing <strong>{startItem}-{endItem}</strong> of <strong>{filteredCount}</strong> transactions
            {filteredCount !== all.length && ` (filtered from ${all.length})`}
          </p>
          <div className={styles.headerActions}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={filteredCount === 0}>
                  <FileSpreadsheet size={16} />
                  Download CSV
                  <ChevronDown size={14} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.exportMenu}>
                <DropdownMenuItem onSelect={handleExportTransactions}>
                  <span className={styles.exportItem}>
                    <strong>Transactions</strong>
                    <span>Every matching payment with source, device and payment details</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportGst}>
                  <span className={styles.exportItem}>
                    <strong>GST subscription report</strong>
                    <span>Invoiced payments in the accountant's register layout</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleDownloadAllInvoicesZip} variant="outline" size="sm" disabled={isDownloadingZip}>
              {isDownloadingZip ? <Loader2 size={16} className={styles.spinner} /> : <Archive size={16} />}
              Download All Invoices (ZIP)
            </Button>
          </div>
        </div>
      )}

      <div className={styles.results}>{renderContent()}</div>
      {renderPagination()}

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className={detailSheetClasses.sheet}>
          {detail && (
            <>
              <SheetHeader className={detailSheetClasses.header}>
                <div className={detailSheetClasses.headerTop}>
                  <SheetTitle>Subscription payment #{detail.id}</SheetTitle>
                  <Badge variant={STATUS_VARIANTS[detail.status]} className={detailSheetClasses.status}>
                    {sentenceCase(detail.status)}
                  </Badge>
                </div>
                <SheetDescription>
                  {formatInr(detail.amount)} by {detail.teacherName}, {formatDateTime(detail.transactionDate)}
                </SheetDescription>
              </SheetHeader>
              <div className={detailSheetClasses.body}>
                <DetailSection
                  title="Transaction"
                  rows={[
                    ["Transaction ID", `#${detail.id}`],
                    ["Gateway transaction ID", detail.transactionId ?? "None", { muted: !detail.transactionId, mono: !!detail.transactionId }],
                    ["Date", formatDateTime(detail.transactionDate)],
                    ["Amount", formatInr(detail.amount)],
                    ["Payment method", methodLabel(detail.paymentMethod), { muted: !detail.paymentMethod }],
                    ["Invoice number", detail.invoiceNumber ?? "Not issued", { muted: !detail.invoiceNumber, mono: !!detail.invoiceNumber }],
                    ...(detail.paymentFailure
                      ? ([["Failure reason", <PaymentFailureReason key="reason" failure={detail.paymentFailure} variant="card" />]] as [string, React.ReactNode][])
                      : []),
                  ]}
                />
                <DetailSection
                  title="Teacher and plan"
                  rows={[
                    ["Teacher", detail.teacherName],
                    ["Email", detail.teacherEmail ?? "Not on file", { muted: !detail.teacherEmail }],
                    ["Plan", detail.planName],
                  ]}
                />
                <ClientSourceSection client={detail.client} inheritedFrom={detail.clientInheritedFrom} capturedFrom="payments started" />
              </div>
              {((detail.status === "completed" && detail.amount > 0) || (detail.status === "pending" && !!detail.transactionId)) && (
                <SheetFooter className={detailSheetClasses.footer}>{renderActions(detail, true)}</SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
