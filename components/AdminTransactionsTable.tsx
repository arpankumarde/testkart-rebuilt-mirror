import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  Ban,
  ChevronDown,
  Coins,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Receipt,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { PaymentFailureReason } from "./PaymentFailureReason";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { SortableTh } from "./SortableTh";
import { OrderPlatformBadge } from "./OrderPlatformBadge";
import { AdminTransactionsFilters } from "./AdminTransactionsFilters";
import { AdminTransactionDetailSheet } from "./AdminTransactionDetailSheet";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./Pagination";
import { getAdminOrdersInvoice } from "../endpoints/admin/orders/invoice_GET.schema";
import { postAdminOrdersInvoiceZip } from "../endpoints/admin/orders/invoice-zip_POST.schema";
import { postReconcileOrder } from "../endpoints/admin/orders/reconcile_POST.schema";
import { postRefundOrder } from "../endpoints/admin/orders/refund_POST.schema";
import { postMarkOrderFailed } from "../endpoints/admin/orders/mark-failed_POST.schema";
import { postReconcileAllOrders } from "../endpoints/admin/orders/reconcile-all_POST.schema";
import { postAdminOrdersExport } from "../endpoints/admin/orders/export_POST.schema";
import type { AdminOrderRow } from "../endpoints/admin/orders/search_POST.schema";
import {
  ADMIN_ORDERS_PREFIX,
  TRANSACTIONS_PAGE_SIZE,
  useAdminOrderFacets,
  useAdminOrderSearch,
} from "../helpers/useAdminOrderSearch";
import { toDayString, useTransactionFilters } from "../helpers/useTransactionFilters";
import type { OrderSortColumn } from "../helpers/adminOrderFilters";
import type { SortOrder } from "../helpers/useTableSort";
import { ORDER_DEVICE_TYPE_LABELS, ORDER_PLATFORM_LABELS, paymentMethodLabel, paymentModeLabel } from "../helpers/orderAttribution";
import { discountMethodLine, ORDER_DISCOUNT_METHOD_LABELS } from "../helpers/orderDiscountMethod";
import {
  browserLabel,
  deviceLabel,
  deviceSummary,
  formatDay,
  formatInr,
  formatTime,
  ITEM_TYPE_LABELS,
  toCsvDateTime,
} from "../helpers/transactionDisplay";
import styles from "./AdminTransactionsTable.module.css";

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const STATUS_VARIANTS: { [key in AdminOrderRow["status"]]: "success" | "warning" | "destructive" | "outline" } = {
  completed: "success",
  pending: "warning",
  failed: "destructive",
  cancelled: "outline",
  refunded: "destructive",
};

/* Text sorts A to Z first; numbers, money and dates start largest or newest. */
const FIRST_ORDER: Record<OrderSortColumn, SortOrder> = {
  id: "desc",
  date: "desc",
  paidAt: "desc",
  student: "asc",
  amount: "desc",
  status: "asc",
};

const OrderStatusBadge: React.FC<{ status: AdminOrderRow["status"] }> = ({ status }) => (
  <Badge variant={STATUS_VARIANTS[status]} className={styles.flag}>
    {sentenceCase(status)}
  </Badge>
);

const renderItemList = (items: AdminOrderRow["purchasedItemDetails"]) => (
  <ul className={styles.itemList}>
    {items.map((item, idx) => (
      <li key={idx}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.itemListLink}>
          {item.title}
          <ExternalLink aria-hidden="true" />
        </a>
        <span className={styles.itemType}>{ITEM_TYPE_LABELS[item.type] ?? item.type}</span>
      </li>
    ))}
  </ul>
);

const renderDate = (date: Date | null) =>
  date ? (
    <div className={styles.stack}>
      <span className={styles.valueLine}>{formatDay(date)}</span>
      <span className={styles.secondaryLine}>{formatTime(date)}</span>
    </div>
  ) : (
    <span className={styles.emptyLine}>Not recorded</span>
  );

const paymentLine = (order: AdminOrderRow) => {
  const mode = paymentModeLabel(order.paymentMode);
  if (order.paymentMethod === "payu") return mode ? `PayU, ${mode}` : "PayU";
  return paymentMethodLabel(order.paymentMethod);
};

/* 1,000 and up as "1K" so the Tcoins chip fits the 7rem Amount column; the tooltip keeps the exact count. */
const compactCoins = (coins: number) =>
  coins >= 1000
    ? new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(coins)
    : coins.toLocaleString("en-IN");

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colOrder} />
    <col className={styles.colDate} />
    <col />
    <col className={styles.colItem} />
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

const OrderRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="3rem" bottom="80%" /></td>
    <td><StackSkeleton top="5rem" bottom="3rem" /></td>
    <td><StackSkeleton top="60%" bottom="80%" /></td>
    <td><StackSkeleton top="75%" bottom="55%" /></td>
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

const OrderCardSkeleton = () => (
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

/* Only orders with an assigned invoice_number are part of the gapless GST invoice series. */
const isInvoiced = (o: AdminOrderRow) => o.status === "completed" && o.totalAmount > 0 && !!o.invoiceNumber;

export const AdminTransactionsTable: React.FC = () => {
  const queryClient = useQueryClient();
  const api = useTransactionFilters();
  const { state, filters, update } = api;
  const { data, isPending, isFetching, isError, error, isPlaceholderData } = useAdminOrderSearch(
    filters,
    state.sort,
    state.page
  );
  const { data: facets } = useAdminOrderFacets();

  const [detail, setDetail] = useState<AdminOrderRow | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<number | null>(null);
  const [reconcilingId, setReconcilingId] = useState<number | null>(null);
  const [markingFailedId, setMarkingFailedId] = useState<number | null>(null);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<null | "csv" | "gst" | "zip">(null);
  const [refundTarget, setRefundTarget] = useState<{ id: number; amount: number } | null>(null);
  const [refundReason, setRefundReason] = useState("");

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));

  // A refund or reconcile refetches the page; keep the open sheet showing the fresh row.
  useEffect(() => {
    if (!detail || !data) return;
    const fresh = data.rows.find((row) => row.id === detail.id);
    if (fresh && fresh !== detail) setDetail(fresh);
  }, [data, detail]);

  // A shared link past the last page lands on the last page instead of an empty list.
  useEffect(() => {
    if (data && !isPlaceholderData && state.page > totalPages) update({ page: totalPages > 1 ? totalPages : null }, true);
  }, [data, isPlaceholderData, state.page, totalPages, update]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_PREFIX });

  const refundMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason: string }) => postRefundOrder({ orderId, reason }),
    onMutate: ({ orderId }) => setRefundingId(orderId),
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Refund failed"),
    onSettled: () => setRefundingId(null),
  });

  const reconcileMutation = useMutation({
    mutationFn: (orderId: number) => postReconcileOrder({ orderId }),
    onMutate: (orderId) => setReconcilingId(orderId),
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.info(result.message);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Reconciliation failed"),
    onSettled: () => setReconcilingId(null),
  });

  const markFailedMutation = useMutation({
    mutationFn: (orderId: number) => postMarkOrderFailed({ orderId }),
    onMutate: (orderId) => setMarkingFailedId(orderId),
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to mark order as failed"),
    onSettled: () => setMarkingFailedId(null),
  });

  const reconcileAllMutation = useMutation({
    mutationFn: () => postReconcileAllOrders({}),
    onSuccess: (result) => {
      toast.success(
        `Reconciled: ${result.reconciled}, Failed or cancelled: ${result.markedFailed}, Still pending: ${result.stillPending}, Errors: ${result.errors}, Reasons added: ${result.reasonsFilled}`
      );
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Bulk reconciliation failed"),
  });

  const confirmRefund = () => {
    if (!refundTarget) return;
    refundMutation.mutate(
      { orderId: refundTarget.id, reason: refundReason.trim() },
      {
        onSuccess: () => {
          setRefundTarget(null);
          setRefundReason("");
        },
      }
    );
  };

  const sort = {
    sortBy: state.sort.column,
    sortOrder: state.sort.direction,
    toggleSort: (column: OrderSortColumn) => {
      const direction =
        column === state.sort.column ? (state.sort.direction === "asc" ? "desc" : "asc") : FIRST_ORDER[column];
      update({ sort: column === "date" && direction === "desc" ? null : column, dir: direction === "desc" ? null : "asc" });
    },
  };

  /** Every order matching the filters, fetched once per export so pagination never limits it. */
  const fetchAllMatching = async () => {
    const result = await postAdminOrdersExport({ filters, sort: state.sort });
    if (result.truncated) {
      toast.warning(`Only the first ${result.rows.length.toLocaleString("en-IN")} of ${result.total.toLocaleString("en-IN")} orders were exported. Narrow the filters to get the rest.`);
    }
    return result.rows;
  };

  const fileSuffix = () => {
    const created = filters.createdFrom || filters.createdTo;
    if (!created) return toDayString(new Date());
    const from = filters.createdFrom ? toDayString(filters.createdFrom) : "start";
    const to = filters.createdTo ? toDayString(new Date(filters.createdTo.getTime() - 1)) : "today";
    return `${from}_to_${to}`;
  };

  const runExport = async (kind: "csv" | "gst" | "zip", task: () => Promise<void>) => {
    setExporting(kind);
    try {
      await task();
    } catch (err) {
      console.error(`Transactions export (${kind}) failed:`, err);
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleExportTransactions = () =>
    runExport("csv", async () => {
      const all = await fetchAllMatching();
      if (all.length === 0) {
        toast.error("No transactions match the current filters.");
        return;
      }
      const csv = Papa.unparse(
        all.map((o) => ({
          "Order ID": o.id,
          "Transaction ID": o.paymentTransactionId ?? "",
          "Created at": toCsvDateTime(o.createdAt),
          "Paid at": toCsvDateTime(o.paidAt),
          Status: sentenceCase(o.status),
          Student: o.studentName,
          Email: o.studentEmail ?? "",
          Mobile: o.studentPhone ?? "",
          Sponsored: o.isSponsored ? "Yes" : "No",
          Items: o.purchasedItemDetails.map((d) => d.title).join(" | ") || o.purchasedItems || "",
          "Item types": [...new Set(o.purchasedItemDetails.map((d) => ITEM_TYPE_LABELS[d.type] ?? d.type))].join(" | "),
          Teacher: o.teacherName ?? "",
          "Original amount (Rs.)": o.originalAmount.toFixed(2),
          "Discount method": ORDER_DISCOUNT_METHOD_LABELS[o.discountMethod],
          "Promo code": o.discountMethod === "promo_code" ? o.promoCode ?? "Not available" : "",
          "Promo applied": o.promoCode ? (o.promoAutoApplied ? "Automatic" : o.promoAutoApplied === false ? "Typed" : "") : "",
          "Promo discount (Rs.)": o.discountMethod === "promo_code" ? o.discountAmount.toFixed(2) : "",
          "Tcoins redeemed": o.tcoinsRedeemed > 0 ? o.tcoinsRedeemed : "",
          "Tcoin discount value (Rs.)": o.tcoinsRedeemed > 0 ? o.tcoinsValue.toFixed(2) : "",
          "Final paid amount (Rs.)": o.totalAmount.toFixed(2),
          Gateway: o.paymentMethod === "payu" ? "PayU" : "",
          "Payment method": paymentMethodLabel(o.paymentMethod),
          "Payment mode": paymentModeLabel(o.paymentMode) ?? "",
          "Invoice number": o.invoiceNumber ?? "",
          Platform: o.client ? ORDER_PLATFORM_LABELS[o.client.platform] : "Not captured",
          OS: o.client?.osName ?? "",
          "OS version": o.client?.osVersion ?? "",
          "Device type": o.client ? ORDER_DEVICE_TYPE_LABELS[o.client.deviceType] : "",
          Device: o.client ? deviceLabel(o.client) : "",
          "Device brand": o.client?.deviceBrand ?? "",
          "Device model": o.client?.deviceModel ?? "",
          Browser: o.client?.browserName ?? "",
          "Browser version": o.client?.browserVersion ?? "",
          "App version": o.client?.appVersion ?? "",
          Screen: o.client?.screen ?? "",
          Source: o.client?.referrer ?? "",
          "IP address": o.client?.ip ?? "",
          "User agent": o.client?.userAgent ?? "",
        }))
      );
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `Transactions_${fileSuffix()}.csv`);
      toast.success(`Exported ${all.length.toLocaleString("en-IN")} transactions`);
    });

  /* The accountant's GST sales register, unchanged in layout: invoiced orders only. */
  const handleExportGst = () =>
    runExport("gst", async () => {
      const eligible = (await fetchAllMatching()).filter(isInvoiced);
      if (eligible.length === 0) {
        toast.error("No invoiced orders match the current filters.");
        return;
      }
      const dataRows = eligible.map((order, index) => {
        const totalAmount = Number(order.totalAmount);
        const baseAmount = totalAmount / 1.18;
        const igst = totalAmount - baseAmount;
        const date = new Date(order.createdAt || Date.now());
        const formattedDate = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
        return [
          index + 1,
          formattedDate,
          order.invoiceNumber!,
          order.paymentTransactionId || `#${order.id}`,
          "",
          order.studentName,
          order.teacherName || "",
          `  ${baseAmount.toFixed(2)} `,
          "18",
          "",
          "",
          `  ${igst.toFixed(2)} `,
          "",
          `  ${totalAmount.toFixed(2)} `,
          order.promoCode || "",
          order.promoCode ? `  ${order.discountAmount.toFixed(2)} ` : "",
        ];
      });
      const header1 =
        "S.No.,Date,Invoice No,Order ID,Supplier GSTIN number,Name of Supplier,Teacher Name,Invoice Base Amount (Rs.),Rate of tax (%),GST,,,Exempted/Nill rated sales (Rs.)  ,Invoice Total (Rs.),Promo Code,Promo Discount (Rs.)\n";
      const header2 = ",,,,,,,,,SGST (Rs.),CGST (Rs.),IGST (Rs.),,,,\n";
      const csv = header1 + header2 + Papa.unparse(dataRows, { header: false });
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `GST_Sales_Report_${fileSuffix()}.csv`);
    });

  const handleDownloadAllInvoicesZip = () =>
    runExport("zip", async () => {
      const eligibleIds = (await fetchAllMatching()).filter(isInvoiced).map((o) => o.id);
      if (eligibleIds.length === 0) {
        toast.error("No invoiced orders match the current filters.");
        return;
      }
      const blob = await postAdminOrdersInvoiceZip({ orderIds: eligibleIds });
      downloadBlob(blob, "sales-invoices.zip");
      toast.success(`Downloaded ${eligibleIds.length} invoices`);
    });

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      setDownloadingOrderId(orderId);
      const blob = await getAdminOrdersInvoice({ orderId });
      downloadBlob(blob, `invoice-${orderId}.pdf`);
      toast.success("Invoice downloaded successfully");
    } catch (err) {
      console.error("Failed to download invoice:", err);
      toast.error(err instanceof Error ? err.message : "Failed to download invoice");
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const getContact = (order: AdminOrderRow) => [order.studentEmail, order.studentPhone].filter(Boolean).join(", ");

  const renderSponsoredFlag = (order: AdminOrderRow) =>
    order.isSponsored ? (
      <Badge variant="secondary" className={styles.flag}>
        Sponsored
      </Badge>
    ) : null;

  const renderItems = (order: AdminOrderRow) => {
    const [first, ...rest] = order.purchasedItemDetails;
    const teacher = order.teacherName || "No teacher";

    if (!first) {
      return (
        <div className={styles.stack}>
          <span className={styles.valueLine} title={order.purchasedItems || undefined}>
            {order.purchasedItems || "N/A"}
          </span>
          <span className={styles.secondaryLine} title={order.teacherName || undefined}>
            {teacher}
          </span>
        </div>
      );
    }

    const itemDetail = `${teacher}, ${ITEM_TYPE_LABELS[first.type] ?? first.type}`;
    return (
      <div className={styles.stack}>
        <span className={styles.itemLine}>
          <a href={first.url} target="_blank" rel="noopener noreferrer" className={styles.itemLink} title={first.title}>
            <span className={styles.truncate}>{first.title}</span>
            <ExternalLink aria-hidden="true" />
          </a>
          {rest.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={styles.moreItems}
                  aria-label={`Show all ${order.purchasedItemDetails.length} items in order #${order.id}`}
                >
                  +{rest.length}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className={styles.itemsPopover}>
                {renderItemList(order.purchasedItemDetails)}
              </PopoverContent>
            </Popover>
          )}
        </span>
        <span className={styles.secondaryLine} title={itemDetail}>
          {itemDetail}
        </span>
      </div>
    );
  };

  const renderSource = (order: AdminOrderRow) => {
    const summary = deviceSummary(order.client);
    const tooltip = order.client
      ? `${deviceLabel(order.client)}, ${browserLabel(order.client)}${order.client.osName ? `, ${order.client.osName}${order.client.osVersion ? ` ${order.client.osVersion}` : ""}` : ""}`
      : "Placed before source capture started on 5 Nov 2026";
    return (
      <div className={styles.stack}>
        <OrderPlatformBadge platform={order.client?.platform ?? "unknown"} className={styles.platformBadge} />
        {order.client && (
          <span className={styles.secondaryLine} title={tooltip}>
            {summary}
          </span>
        )}
      </div>
    );
  };

  const renderActions = (order: AdminOrderRow, withLabels = false) => {
    const action = (
      key: string,
      label: string,
      icon: React.ReactNode,
      onClick: () => void,
      disabled: boolean,
      danger = false
    ) =>
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
              aria-label={`${label} for order #${order.id}`}
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
    if (order.status === "completed" && order.totalAmount > 0) {
      items.push(
        action("invoice", "Download invoice", downloadingOrderId === order.id ? spinner : <Download />, () => handleDownloadInvoice(order.id), downloadingOrderId === order.id)
      );
    }
    if (order.status === "completed") {
      items.push(
        action(
          "refund",
          "Refund order",
          refundingId === order.id ? spinner : <Undo2 />,
          () => setRefundTarget({ id: order.id, amount: order.totalAmount }),
          refundingId === order.id,
          true
        )
      );
    }
    if ((order.status === "pending" || order.status === "cancelled" || order.status === "failed") && order.paymentTransactionId) {
      const busy = reconcilingId === order.id || markingFailedId === order.id;
      items.push(
        action("reconcile", "Reconcile order", reconcilingId === order.id ? spinner : <RefreshCw />, () => reconcileMutation.mutate(order.id), busy),
        action("fail", "Mark as failed", markingFailedId === order.id ? spinner : <Ban />, () => markFailedMutation.mutate(order.id), busy, true)
      );
    }
    return <div className={styles.rowActions}>{items}</div>;
  };

  const openFromRow = (event: React.MouseEvent<HTMLTableRowElement>, order: AdminOrderRow) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, [role='dialog']")) return;
    if (window.getSelection()?.toString()) return;
    setDetail(order);
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
                  <OrderRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => (
              <OrderCardSkeleton key={i} />
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
          title="Failed to load transactions"
          description={error instanceof Error ? error.message : "Please try again later."}
        />
      );
    }

    if (rows.length === 0) {
      return api.hasAnyFilter ? (
        <ConsoleListEmpty
          icon={<Receipt size={24} />}
          title="No transactions match your filters"
          description="Remove a filter or widen the date range."
        />
      ) : (
        <ConsoleListEmpty icon={<Receipt size={24} />} title="No student transactions found" />
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="id" sort={sort}>Order</SortableTh>
                <SortableTh column="date" sort={sort}>Date</SortableTh>
                <SortableTh column="student" sort={sort}>Student</SortableTh>
                <th>Item and teacher</th>
                <th>Source</th>
                <SortableTh column="amount" sort={sort} className={styles.num}>Amount</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => {
                const contact = getContact(order);
                const line = paymentLine(order);
                return (
                  <tr key={order.id} className={styles.clickableRow} onClick={(e) => openFromRow(e, order)}>
                    <td>
                      <div className={styles.stack}>
                        <button
                          type="button"
                          className={styles.orderButton}
                          onClick={() => setDetail(order)}
                          aria-label={`Open details for order #${order.id}`}
                        >
                          #{order.id}
                        </button>
                        <span className={styles.secondaryLine} title={order.paymentTransactionId || undefined}>
                          {order.paymentTransactionId || "No transaction ID"}
                        </span>
                      </div>
                    </td>
                    <td>{renderDate(order.createdAt)}</td>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.primaryLine}>
                          <span className={styles.truncate} title={order.studentName}>
                            {order.studentName}
                          </span>
                          {renderSponsoredFlag(order)}
                        </span>
                        <span className={styles.secondaryLine} title={contact || undefined}>
                          {contact || "No email or phone"}
                        </span>
                      </div>
                    </td>
                    <td>{renderItems(order)}</td>
                    <td>{renderSource(order)}</td>
                    <td className={styles.num}>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{formatInr(order.totalAmount)}</span>
                        <span className={styles.secondaryLine} title={line}>
                          {line}
                        </span>
                        {order.promoCode && (
                          <span
                            className={styles.promoLine}
                            title={`Promo ${order.promoCode}, ${formatInr(order.discountAmount)} off`}
                          >
                            {order.promoCode}
                          </span>
                        )}
                        {order.tcoinsRedeemed > 0 && (
                          <span
                            className={styles.tcoinsLine}
                            title={`${order.tcoinsRedeemed.toLocaleString("en-IN")} Tcoins used, ${formatInr(order.tcoinsValue)} off`}
                            aria-label={`${order.tcoinsRedeemed.toLocaleString("en-IN")} Tcoins used, ${formatInr(order.tcoinsValue)} off`}
                          >
                            <Coins aria-hidden="true" />
                            <span className={styles.tcoinsText}>{compactCoins(order.tcoinsRedeemed)} Tcoins</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        <OrderStatusBadge status={order.status} />
                        {order.paymentFailure && <PaymentFailureReason failure={order.paymentFailure} />}
                      </div>
                    </td>
                    <td>{renderActions(order)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {rows.map((order) => {
            const contact = getContact(order);
            return (
              <article key={order.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.stack}>
                    <span className={styles.primaryLine}>
                      <span className={styles.truncate} title={order.studentName}>
                        {order.studentName}
                      </span>
                      <OrderStatusBadge status={order.status} />
                      {renderSponsoredFlag(order)}
                    </span>
                    <span className={styles.secondaryLine} title={contact || undefined}>
                      {contact || "No email or phone"}
                    </span>
                  </div>
                  {renderActions(order)}
                </div>
                {order.purchasedItemDetails.length > 0 ? (
                  renderItemList(order.purchasedItemDetails)
                ) : (
                  <p className={styles.cardItemsFallback}>{order.purchasedItems || "N/A"}</p>
                )}
                <dl className={styles.cardStats}>
                  <div className={styles.cardStat}><dt>Order</dt><dd>#{order.id}</dd></div>
                  <div className={styles.cardStat}><dt>Amount</dt><dd>{formatInr(order.totalAmount)}</dd></div>
                  <div className={styles.cardStat}>
                    <dt>Payment</dt>
                    <dd>{[paymentMethodLabel(order.paymentMethod), paymentModeLabel(order.paymentMode)].filter(Boolean).join(", ")}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Date</dt>
                    <dd>{order.createdAt ? `${formatDay(order.createdAt)}, ${formatTime(order.createdAt)}` : "Not recorded"}</dd>
                  </div>
                  <div className={styles.cardStat}><dt>Teacher</dt><dd>{order.teacherName || "No teacher"}</dd></div>
                  <div className={styles.cardStat}>
                    <dt>Discount</dt>
                    <dd>{discountMethodLine({ method: order.discountMethod, tcoinsRedeemed: order.tcoinsRedeemed }, order.promoCode)}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Source</dt>
                    <dd>{order.client ? ORDER_PLATFORM_LABELS[order.client.platform] : "Not captured"}</dd>
                  </div>
                  {order.client && (
                    <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                      <dt>Device</dt>
                      <dd>{deviceSummary(order.client)}</dd>
                    </div>
                  )}
                  {order.paymentFailure && (
                    <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                      <dt>Reason</dt>
                      <dd><PaymentFailureReason failure={order.paymentFailure} variant="card" /></dd>
                    </div>
                  )}
                </dl>
                <Button variant="outline" size="sm" onClick={() => setDetail(order)} className={styles.cardDetails}>
                  View details
                </Button>
              </article>
            );
          })}
        </div>
      </>
    );
  };

  const startItem = total > 0 ? (state.page - 1) * TRANSACTIONS_PAGE_SIZE + 1 : 0;
  const endItem = Math.min(state.page * TRANSACTIONS_PAGE_SIZE, total);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === state.page) return;
    update({ page: page === 1 ? null : page }, true);
    document.getElementById("transactions-results")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages: (number | "...")[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= state.page - 1 && i <= state.page + 1)) pages.push(i);
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
                  goToPage(state.page - 1);
                }}
                className={state.page === 1 ? styles.disabledPagination : ""}
              />
            </PaginationItem>
            {pages.map((p, i) => (
              <PaginationItem key={i}>
                {p === "..." ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href="#"
                    isActive={p === state.page}
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
                  goToPage(state.page + 1);
                }}
                className={state.page === totalPages ? styles.disabledPagination : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <AdminTransactionsFilters api={api} facets={facets} />

      <div className={styles.tableHeader} id="transactions-results">
        <p className={styles.resultsCount} aria-live="polite">
          {isPending ? (
            "Loading transactions"
          ) : (
            <>
              Showing <strong>{startItem.toLocaleString("en-IN")}-{endItem.toLocaleString("en-IN")}</strong> of{" "}
              <strong>{total.toLocaleString("en-IN")}</strong> transactions
              {isFetching && !isPending && <span className={styles.updating}>Updating</span>}
            </>
          )}
        </p>

        <div className={styles.headerActions}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting !== null || total === 0}>
                {exporting === "csv" || exporting === "gst" ? <Loader2 size={16} className={styles.spinner} /> : <FileSpreadsheet size={16} />}
                Download CSV
                <ChevronDown size={14} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.exportMenu}>
              <DropdownMenuItem onSelect={handleExportTransactions}>
                <span className={styles.exportItem}>
                  <strong>Transactions</strong>
                  <span>Every matching order with source, device and payment details</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportGst}>
                <span className={styles.exportItem}>
                  <strong>GST sales report</strong>
                  <span>Invoiced orders in the accountant's register layout</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={handleDownloadAllInvoicesZip} variant="outline" disabled={exporting !== null || total === 0}>
            {exporting === "zip" ? <Loader2 size={16} className={styles.spinner} /> : <Archive size={16} />}
            Download All Invoices (ZIP)
          </Button>

          {(data?.reconcilable ?? 0) > 0 && (
            <Button onClick={() => reconcileAllMutation.mutate()} disabled={reconcileAllMutation.isPending}>
              {reconcileAllMutation.isPending ? <Loader2 className={styles.spinner} size={16} /> : <RefreshCw size={16} />}
              Reconcile All Pending
            </Button>
          )}
        </div>
      </div>

      <div className={styles.results} aria-busy={isFetching}>
        {renderContent()}
      </div>
      {renderPagination()}

      <AdminTransactionDetailSheet
        order={detail}
        onOpenChange={(open) => !open && setDetail(null)}
        actions={detail ? renderActions(detail, true) : undefined}
      />

      <ConsoleConfirmDialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        tone="destructive"
        icon={<Undo2 size={20} />}
        title="Refund this order?"
        description={
          refundTarget
            ? `Order #${refundTarget.id} for ${formatInr(refundTarget.amount)} is marked refunded, and the amount comes back out of the teacher's earnings. The money itself is returned through PayU separately.`
            : undefined
        }
        note={{
          label: "Reason for the refund",
          value: refundReason,
          onChange: setRefundReason,
          placeholder: "For example: bought the wrong test by mistake",
          hint: "The student sees this on their order and the teacher sees it in their earnings.",
          required: true,
        }}
        confirmLabel="Refund order"
        pendingLabel="Refunding..."
        isPending={refundMutation.isPending}
        onConfirm={confirmRefund}
      />
    </div>
  );
};
