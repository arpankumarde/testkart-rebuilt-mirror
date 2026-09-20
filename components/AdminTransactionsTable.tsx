import React, { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminOrdersQuery, ADMIN_ORDERS_QUERY_KEY } from "../helpers/useAdminOrders";
import { Order } from "../endpoints/admin/orders_GET.schema";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { ConsoleFilterNotice } from "./ConsoleFilterNotice";
import { PaymentFailureReason } from "./PaymentFailureReason";
import { AlertCircle, Ban, Download, Loader2, RefreshCw, FileSpreadsheet, ExternalLink, Undo2, Archive, Receipt } from "lucide-react";
import Papa from "papaparse";
import { getAdminOrdersInvoice } from "../endpoints/admin/orders/invoice_GET.schema";
import { postAdminOrdersInvoiceZip } from "../endpoints/admin/orders/invoice-zip_POST.schema";
import { postReconcileOrder } from "../endpoints/admin/orders/reconcile_POST.schema";
import { postRefundOrder } from "../endpoints/admin/orders/refund_POST.schema";
import { postMarkOrderFailed } from "../endpoints/admin/orders/mark-failed_POST.schema";
import { postReconcileAllOrders } from "../endpoints/admin/orders/reconcile-all_POST.schema";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./Pagination";
import { toast } from "sonner";
import { FilterSection, FilterState, useTransactionsListParams } from "./AdminTransactionsTableFilter";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { SortableTh } from "./SortableTh";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import styles from "./AdminTransactionsTable.module.css";

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const SORT_ACCESSORS: SortAccessors<Order, "id" | "date" | "student" | "items" | "amount" | "status"> = {
  id: (o) => o.id,
  date: (o) => (o.createdAt ? new Date(o.createdAt) : null),
  student: (o) => o.studentName,
  items: (o) => o.purchasedItems,
  amount: (o) => o.totalAmount,
  status: (o) => o.status,
};

/* Matches the dashboard's stuck-orders count: pending and created more than an hour ago. */
const STALE_PENDING_MS = 60 * 60 * 1000;

type LocalFilters = Omit<FilterState, "status">;

const DEFAULT_LOCAL_FILTERS: LocalFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  paymentMethod: "__all",
};

const STATUS_VARIANTS: { [key in Order["status"]]: "success" | "warning" | "destructive" | "outline" } = {
  completed: "success",
  pending: "warning",
  failed: "destructive",
  cancelled: "outline",
  refunded: "destructive",
};

const OrderStatusBadge: React.FC<{ status: Order["status"] }> = ({ status }) => (
  <Badge variant={STATUS_VARIANTS[status]} className={styles.flag}>
    {sentenceCase(status)}
  </Badge>
);

const formatItemType = (type: string) => {
  switch (type) {
    case 'test': return 'Mock test';
    case 'live_test': return 'Live test';
    case 'course': return 'Course';
    case 'product': return 'Notes';
    case 'bundle': return 'Bundle';
    default: return type;
  }
};

const formatDay = (date: Date): string =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

const formatTime = (date: Date): string =>
  new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const renderDate = (date: Date | null) =>
  date ? (
    <div className={styles.stack}>
      <span className={styles.valueLine}>{formatDay(date)}</span>
      <span className={styles.secondaryLine}>{formatTime(date)}</span>
    </div>
  ) : (
    <span className={styles.emptyLine}>Not recorded</span>
  );

const renderItemList = (items: Order["purchasedItemDetails"]) => (
  <ul className={styles.itemList}>
    {items.map((item, idx) => (
      <li key={idx}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.itemListLink}>
          {item.title}
          <ExternalLink aria-hidden="true" />
        </a>
        <span className={styles.itemType}>{formatItemType(item.type)}</span>
      </li>
    ))}
  </ul>
);

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colOrder} />
    <col className={styles.colDate} />
    <col />
    <col className={styles.colItem} />
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

export const AdminTransactionsTable: React.FC = () => {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;
  const { data: orders, dataUpdatedAt, isFetching, isError, error } = useAdminOrdersQuery();
  const { status: statusParam, listFilter, write } = useTransactionsListParams();
  const [downloadingOrderId, setDownloadingOrderId] = useState<number | null>(null);
  const [reconcilingId, setReconcilingId] = useState<number | null>(null);
  const [markingFailedId, setMarkingFailedId] = useState<number | null>(null);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [refundTarget, setRefundTarget] = useState<{ id: number; amount: number } | null>(null);

  const refundMutation = useMutation({
    mutationFn: (orderId: number) => postRefundOrder({ orderId }),
    onMutate: (orderId) => {
      setRefundingId(orderId);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Refund failed");
    },
    onSettled: () => {
      setRefundingId(null);
    },
  });

  const confirmRefund = () => {
    if (!refundTarget) return;
    refundMutation.mutate(refundTarget.id, {
      onSuccess: () => setRefundTarget(null),
    });
  };

  const reconcileMutation = useMutation({
    mutationFn: (orderId: number) => postReconcileOrder({ orderId }),
    onMutate: (orderId) => {
      setReconcilingId(orderId);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.info(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Reconciliation failed");
    },
    onSettled: () => {
      setReconcilingId(null);
    },
  });

  const markFailedMutation = useMutation({
    mutationFn: (orderId: number) => postMarkOrderFailed({ orderId }),
    onMutate: (orderId) => {
      setMarkingFailedId(orderId);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to mark order as failed");
    },
    onSettled: () => {
      setMarkingFailedId(null);
    },
  });

  const handleReconcile = (orderId: number) => {
    reconcileMutation.mutate(orderId);
  };

  const handleMarkAsFailed = (orderId: number) => {
    markFailedMutation.mutate(orderId);
  };

  const reconcileAllMutation = useMutation({
    mutationFn: () => postReconcileAllOrders({}),
    onSuccess: (data) => {
      toast.success(
        `Reconciled: ${data.reconciled}, Failed: ${data.markedFailed}, Still Pending: ${data.stillPending}, Errors: ${data.errors}`
      );
      queryClient.invalidateQueries({ queryKey: ADMIN_ORDERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Bulk reconciliation failed");
    },
  });

  const [localFilters, setLocalFilters] = useState<LocalFilters>(DEFAULT_LOCAL_FILTERS);
  const filters = useMemo<FilterState>(
    () => ({ ...localFilters, status: statusParam }),
    [localFilters, statusParam]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [statusParam, listFilter]);

  const formatPaymentMethod = (method: string): string => {
    const labels: Record<string, string> = {
      payu: "PayU",
      wallet: "Wallet",
      free: "Free",
    };
    return labels[method.toLowerCase()] || method.charAt(0).toUpperCase() + method.slice(1);
  };

  // Known payment methods that should always appear as filter options
  const KNOWN_PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: "payu", label: "PayU" },
    { value: "wallet", label: "Wallet" },
    { value: "free", label: "Free" },
  ];

  const KNOWN_PAYMENT_METHOD_VALUES = new Set(KNOWN_PAYMENT_METHODS.map((m) => m.value));

  // Extract unique payment methods from orders that are NOT already in the known list
  const dynamicPaymentMethods = useMemo(() => {
    if (!orders) return [];
    const methods = new Set<string>();
    orders.forEach((order) => {
      if (order.paymentMethod && !KNOWN_PAYMENT_METHOD_VALUES.has(order.paymentMethod.toLowerCase())) {
        methods.add(order.paymentMethod);
      }
    });
    return Array.from(methods).sort();
  }, [orders]);

  const handleFilterChange = ({ status, ...rest }: FilterState) => {
    setLocalFilters(rest);
    setCurrentPage(1);
    if (status !== statusParam) write({ status: status === "__all" ? null : status });
  };

  const handleClearFilters = () => {
    setLocalFilters(DEFAULT_LOCAL_FILTERS);
    setCurrentPage(1);
    write({ status: null, filter: null });
  };

  // Apply filters
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = order.studentName.toLowerCase().includes(searchLower);
        const emailMatch = order.studentEmail?.toLowerCase().includes(searchLower) ?? false;
        const phoneMatch = order.studentPhone?.toLowerCase().includes(searchLower) ?? false;
        if (!nameMatch && !emailMatch && !phoneMatch) return false;
      }

      // Status filter
      if (filters.status !== "__all" && order.status !== filters.status) {
        return false;
      }

      if (listFilter === "stale-pending") {
        if (order.status !== "pending" || !order.createdAt) return false;
        if (new Date(order.createdAt).getTime() >= dataUpdatedAt - STALE_PENDING_MS) return false;
      }

      // Payment method filter
      if (filters.paymentMethod !== "__all") {
        if (order.paymentMethod !== filters.paymentMethod) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        if (!order.createdAt) return false;
        
        const orderDate = new Date(order.createdAt);
        orderDate.setHours(0, 0, 0, 0); // Reset time for date-only comparison

        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (orderDate < fromDate) return false;
        }

        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (orderDate > toDate) return false;
        }
      }

      return true;
    });
  }, [orders, filters, listFilter, dataUpdatedAt]);

  const { sorted: sortedOrders, toggleSort: toggleSortColumn, ...sortState } = useTableSort(filteredOrders, SORT_ACCESSORS);
  const sort = {
    ...sortState,
    toggleSort: (column: keyof typeof SORT_ACCESSORS) => {
      setCurrentPage(1);
      toggleSortColumn(column);
    },
  };

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedOrders.slice(start, start + PAGE_SIZE);
  }, [sortedOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);

  const hasPendingToReconcile = useMemo(() => {
    return orders?.some((o) => o.status === "pending" && !!o.paymentTransactionId) ?? false;
  }, [orders]);

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const handleExportCSV = () => {
    // Only orders with an assigned invoice_number are part of the gapless
    // GST invoice series (pre-cutover legacy orders, and orders whose number
    // the sweep job hasn't assigned yet, are excluded rather than shown with
    // a made-up number — that's what keeps this export gap-free).
    const eligibleOrders = filteredOrders.filter(
      (o) => o.status === "completed" && o.totalAmount > 0 && !!o.invoiceNumber
    );

    const dataRows = eligibleOrders.map((order, index) => {
      const total = Number(order.totalAmount);
      const baseAmount = total / 1.18;
      const igst = total - baseAmount;

      const date = new Date(order.createdAt || Date.now());
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      const invoiceNo = order.invoiceNumber!;

      return [
        index + 1,
        formattedDate,
        invoiceNo,
        "",
        order.studentName,
        order.teacherName || "",
        `  ${baseAmount.toFixed(2)} `,
        "18",
        "",
        "",
        `  ${igst.toFixed(2)} `,
        "",
        `  ${total.toFixed(2)} `
      ];
    });

    const header1 = "S.No.,Date,Invoice No,Supplier GSTIN number,Name of Supplier,Teacher Name,Invoice Base Amount (Rs.),Rate of tax (%),GST,,,Exempted/Nill rated sales (Rs.)  ,Invoice Total (Rs.)\n";
    const header2 = ",,,,,,,SGST (Rs.),CGST (Rs.),IGST (Rs.),,\n";

    const csvData = Papa.unparse(dataRows, { header: false });
    const finalCsv = header1 + header2 + csvData;

    let filename = "GST_Sales_Report.csv";
    if (filters.dateFrom && filters.dateTo) {
      filename = `GST_Sales_Report_${filters.dateFrom}_to_${filters.dateTo}.csv`;
    } else if (filters.dateFrom) {
      filename = `GST_Sales_Report_from_${filters.dateFrom}.csv`;
    } else if (filters.dateTo) {
      filename = `GST_Sales_Report_to_${filters.dateTo}.csv`;
    }

    const blob = new Blob([finalCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllInvoicesZip = async () => {
    const eligibleIds = filteredOrders
      .filter((o) => o.status === "completed" && o.totalAmount > 0 && !!o.invoiceNumber)
      .map((o) => o.id);

    if (eligibleIds.length === 0) {
      toast.error("No invoiced orders match the current filters.");
      return;
    }

    try {
      setIsDownloadingZip(true);
      const blob = await postAdminOrdersInvoiceZip({ orderIds: eligibleIds });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sales-invoices.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${eligibleIds.length} invoices`);
    } catch (error) {
      console.error("Failed to download invoices zip:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download invoices");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      setDownloadingOrderId(orderId);
      const blob = await getAdminOrdersInvoice({ orderId });
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download invoice');
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const getContact = (order: Order) =>
    [order.studentEmail, order.studentPhone].filter(Boolean).join(", ");

  const renderSponsoredFlag = (order: Order) =>
    order.isSponsored ? (
      <Badge variant="secondary" className={styles.flag}>Sponsored</Badge>
    ) : null;

  const renderItems = (order: Order) => {
    const [first, ...rest] = order.purchasedItemDetails;
    const teacher = order.teacherName || "No teacher";

    if (!first) {
      return (
        <div className={styles.stack}>
          <span className={styles.valueLine} title={order.purchasedItems || undefined}>
            {order.purchasedItems || "N/A"}
          </span>
          <span className={styles.secondaryLine} title={order.teacherName || undefined}>{teacher}</span>
        </div>
      );
    }

    const detail = `${teacher}, ${formatItemType(first.type)}`;
    return (
      <div className={styles.stack}>
        <span className={styles.itemLine}>
          <a
            href={first.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.itemLink}
            title={first.title}
          >
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
        <span className={styles.secondaryLine} title={detail}>{detail}</span>
      </div>
    );
  };

  const renderActions = (order: Order) => (
    <div className={styles.rowActions}>
      {order.status === 'completed' && order.totalAmount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              aria-label={`Download invoice for order #${order.id}`}
              onClick={() => handleDownloadInvoice(order.id)}
              disabled={downloadingOrderId === order.id}
            >
              {downloadingOrderId === order.id ? <Loader2 className={styles.spinner} /> : <Download />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download invoice</TooltipContent>
        </Tooltip>
      )}
      {order.status === 'completed' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Refund order #${order.id}`}
              onClick={() => setRefundTarget({ id: order.id, amount: order.totalAmount })}
              disabled={refundingId === order.id}
            >
              {refundingId === order.id ? <Loader2 className={styles.spinner} /> : <Undo2 />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refund order</TooltipContent>
        </Tooltip>
      )}
      {(order.status === 'pending' || order.status === 'cancelled' || order.status === 'failed') && order.paymentTransactionId && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.iconButton}
                aria-label={`Reconcile order #${order.id}`}
                onClick={() => handleReconcile(order.id)}
                disabled={reconcilingId === order.id || markingFailedId === order.id}
              >
                {reconcilingId === order.id ? <Loader2 className={styles.spinner} /> : <RefreshCw />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reconcile order</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                aria-label={`Mark order #${order.id} as failed`}
                onClick={() => handleMarkAsFailed(order.id)}
                disabled={markingFailedId === order.id || reconcilingId === order.id}
              >
                {markingFailedId === order.id ? <Loader2 className={styles.spinner} /> : <Ban />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as failed</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <OrderRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <OrderCardSkeleton key={i} />)}
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

    if (!orders || orders.length === 0) {
      return <ConsoleListEmpty icon={<Receipt size={24} />} title="No student transactions found" />;
    }

    if (filteredOrders.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Receipt size={24} />}
          title="No transactions match your filters"
          description="Try adjusting your search criteria."
        />
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
                <SortableTh column="items" sort={sort}>Item and teacher</SortableTh>
                <SortableTh column="amount" sort={sort} className={styles.num}>Amount</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => {
                const contact = getContact(order);
                const method = order.paymentMethod ? formatPaymentMethod(order.paymentMethod) : "No method";
                return (
                  <tr key={order.id}>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>#{order.id}</span>
                        <span className={styles.secondaryLine} title={order.paymentTransactionId || undefined}>
                          {order.paymentTransactionId || "No transaction ID"}
                        </span>
                      </div>
                    </td>
                    <td>{renderDate(order.createdAt)}</td>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.primaryLine}>
                          <span className={styles.truncate} title={order.studentName}>{order.studentName}</span>
                          {renderSponsoredFlag(order)}
                        </span>
                        <span className={styles.secondaryLine} title={contact || undefined}>
                          {contact || "No email or phone"}
                        </span>
                      </div>
                    </td>
                    <td>{renderItems(order)}</td>
                    <td className={styles.num}>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{formatCurrency(order.totalAmount)}</span>
                        <span className={styles.secondaryLine} title={method}>{method}</span>
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
          {paginatedOrders.map((order) => {
            const contact = getContact(order);
            return (
              <article key={order.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.stack}>
                    <span className={styles.primaryLine}>
                      <span className={styles.truncate} title={order.studentName}>{order.studentName}</span>
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
                  <div className={styles.cardStat}><dt>Amount</dt><dd>{formatCurrency(order.totalAmount)}</dd></div>
                  <div className={styles.cardStat}>
                    <dt>Method</dt>
                    <dd>{order.paymentMethod ? formatPaymentMethod(order.paymentMethod) : "No method"}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Date</dt>
                    <dd>{order.createdAt ? `${formatDay(order.createdAt)}, ${formatTime(order.createdAt)}` : "Not recorded"}</dd>
                  </div>
                  <div className={styles.cardStat}><dt>Teacher</dt><dd>{order.teacherName || "No teacher"}</dd></div>
                  <div className={styles.cardStat}>
                    <dt>Transaction ID</dt>
                    <dd>{order.paymentTransactionId || "No transaction ID"}</dd>
                  </div>
                  {order.paymentFailure && (
                    <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                      <dt>Reason</dt>
                      <dd><PaymentFailureReason failure={order.paymentFailure} variant="card" /></dd>
                    </div>
                  )}
                </dl>
              </article>
            );
          })}
        </div>
      </>
    );
  };

  const totalOrders = orders?.length || 0;
  const filteredCount = filteredOrders.length;
  const showingFiltered = totalOrders !== filteredCount && totalOrders > 0;

  const startItem = (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, filteredCount);

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
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
                  if (currentPage > 1) setCurrentPage(currentPage - 1);
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
                      setCurrentPage(p as number);
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
                  if (currentPage < totalPages) setCurrentPage(currentPage + 1);
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
    <div className={styles.container}>
      <FilterSection
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasListFilter={listFilter !== ""}
        knownPaymentMethods={KNOWN_PAYMENT_METHODS}
        dynamicPaymentMethods={dynamicPaymentMethods}
      />

      {listFilter === "stale-pending" && (
        <ConsoleFilterNotice
          label="Pending orders older than an hour"
          count={!isFetching && orders ? filteredCount : undefined}
          onClear={() => write({ filter: null })}
          clearLabel="Show all"
        />
      )}

      {!isFetching && orders && orders.length > 0 && (
        <div className={styles.tableHeader}>
          <div className={styles.resultsCount}>
            <p>
              Showing <strong>{filteredCount > 0 ? startItem : 0}-{endItem}</strong> of <strong>{filteredCount}</strong> transactions
              {showingFiltered && ` (filtered from ${totalOrders})`}
            </p>
          </div>

          <div className={styles.headerActions}>
            <Button onClick={handleExportCSV} variant="outline">
              <FileSpreadsheet size={16} />
              Download CSV
            </Button>

            <Button onClick={handleDownloadAllInvoicesZip} variant="outline" disabled={isDownloadingZip}>
              {isDownloadingZip ? (
                <Loader2 size={16} className={styles.spinner} />
              ) : (
                <Archive size={16} />
              )}
              Download All Invoices (ZIP)
            </Button>

            {hasPendingToReconcile && (
              <Button
                onClick={() => reconcileAllMutation.mutate()}
                disabled={reconcileAllMutation.isPending}
              >
                {reconcileAllMutation.isPending ? (
                  <Loader2 className={styles.spinner} size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                Reconcile All Pending
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={styles.results}>{renderContent()}</div>
      {renderPagination()}

      <ConsoleConfirmDialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        tone="destructive"
        icon={<Undo2 size={20} />}
        title="Refund this order?"
        description={
          refundTarget
            ? `Order #${refundTarget.id} for ${formatCurrency(refundTarget.amount)} is marked refunded, and the amount comes back out of the teacher's earnings. The money itself is returned through PayU separately.`
            : undefined
        }
        confirmLabel="Refund order"
        pendingLabel="Refunding..."
        isPending={refundMutation.isPending}
        onConfirm={confirmRefund}
      />
    </div>
  );
};
