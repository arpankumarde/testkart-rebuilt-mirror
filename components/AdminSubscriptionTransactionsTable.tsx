import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminSubscriptionTransactions } from "../helpers/useAdminSubscriptionTransactions";
import { SubscriptionTransactionItem } from "../endpoints/admin/subscription-transactions/list_GET.schema";
import { postReconcileSubscriptionTransaction } from "../endpoints/admin/subscription-transactions/reconcile_POST.schema";
import { postMarkSubscriptionTransactionFailed } from "../endpoints/admin/subscription-transactions/mark-failed_POST.schema";
import { getAdminSubscriptionTransactionInvoice } from "../endpoints/admin/subscription-transactions/invoice_GET.schema";
import { TransactionStatus } from "../helpers/schema";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import { SortableTh } from "./SortableTh";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { PaymentFailureReason } from "./PaymentFailureReason";
import { AlertCircle, Ban, Search, X, Loader2, RefreshCw, Download, FileSpreadsheet, Archive, Receipt } from "lucide-react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./Pagination";
import { toast } from "sonner";
import Papa from "papaparse";
import { postAdminSubscriptionInvoiceZip } from "../endpoints/admin/subscription-transactions/invoice-zip_POST.schema";
import styles from "./AdminSubscriptionTransactionsTable.module.css";

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const SORT_ACCESSORS: SortAccessors<
  SubscriptionTransactionItem,
  "id" | "date" | "teacher" | "plan" | "amount" | "status"
> = {
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

const TransactionStatusBadge: React.FC<{ status: TransactionStatus }> = ({ status }) => (
  <Badge variant={STATUS_VARIANTS[status]} className={styles.flag}>
    {sentenceCase(status)}
  </Badge>
);

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

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colTransaction} />
    <col className={styles.colDate} />
    <col />
    <col className={styles.colPlan} />
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

interface FilterState {
  search: string;
  status: string;
  plan: string;
}

const FilterSection: React.FC<{
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  plans: string[];
}> = ({ filters, onFilterChange, plans }) => {
  const handleClearFilters = () => {
    onFilterChange({ search: "", status: "__all", plan: "__all" });
  };

  const hasActiveFilters =
    filters.search ||
    filters.status !== "__all" ||
    filters.plan !== "__all";

  return (
    <div className={styles.filterSection}>
      <div className={styles.filterGrid}>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Search</label>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <Input
              type="search"
              placeholder="Teacher name or email..."
              value={filters.search}
              onChange={(e) =>
                onFilterChange({ ...filters, search: e.target.value })
              }
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Status</label>
          <Select
            value={filters.status}
            onValueChange={(value) =>
              onFilterChange({ ...filters, status: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Plan</label>
          <Select
            value={filters.plan}
            onValueChange={(value) =>
              onFilterChange({ ...filters, plan: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Plans</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan} value={plan}>
                  {plan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterItemButton}>
          <Button
            variant="outline"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            <X size={16} />
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

interface Props {
  className?: string;
}

export const AdminSubscriptionTransactionsTable: React.FC<Props> = ({
  className,
}) => {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;
  const { data: transactions, isFetching, isError, error } =
    useAdminSubscriptionTransactions();

  const [reconcilingId, setReconcilingId] = useState<number | null>(null);
  const [markingFailedId, setMarkingFailedId] = useState<number | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleExportCSV = () => {
    // Mirrors AdminTransactionsTable's sales CSV export. Only transactions
    // with an assigned invoice_number are part of the gapless GST invoice
    // series, so unnumbered ones (free, or not yet processed by the sweep)
    // are excluded rather than shown with a made-up number.
    const eligibleTransactions = filteredTransactions.filter(
      (t) => t.status === "completed" && t.amount > 0 && !!t.invoiceNumber
    );

    const dataRows = eligibleTransactions.map((t, index) => {
      const total = t.amount;
      const baseAmount = total / 1.18;
      const igst = total - baseAmount;

      const date = new Date(t.transactionDate || Date.now());
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      return [
        index + 1,
        formattedDate,
        t.invoiceNumber!,
        "",
        t.teacherName,
        t.planName,
        `  ${baseAmount.toFixed(2)} `,
        "18",
        "",
        "",
        `  ${igst.toFixed(2)} `,
        "",
        `  ${total.toFixed(2)} `,
      ];
    });

    const header1 = "S.No.,Date,Invoice No,Supplier GSTIN number,Teacher Name,Plan,Invoice Base Amount (Rs.),Rate of tax (%),GST,,,Exempted/Nill rated sales (Rs.)  ,Invoice Total (Rs.)\n";
    const header2 = ",,,,,,,SGST (Rs.),CGST (Rs.),IGST (Rs.),,\n";

    const csvData = Papa.unparse(dataRows, { header: false });
    const finalCsv = header1 + header2 + csvData;

    const filename = "GST_Subscription_Report.csv";
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
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "subscription-invoices.zip";
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

  const handleDownloadInvoice = async (transactionId: number) => {
    try {
      setDownloadingInvoiceId(transactionId);
      const blob = await getAdminSubscriptionTransactionInvoice({ transactionId });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-subscription-${transactionId}.pdf`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Invoice downloaded successfully");
    } catch (error) {
      console.error("Failed to download invoice:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download invoice");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const reconcileMutation = useMutation({
    mutationFn: (transactionId: number) =>
      postReconcileSubscriptionTransaction({ transactionId }),
    onMutate: (transactionId) => {
      setReconcilingId(transactionId);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.info(data.message);
      }
      queryClient.invalidateQueries({
        queryKey: ["admin", "subscription-transactions"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Reconciliation failed"
      );
    },
    onSettled: () => {
      setReconcilingId(null);
    },
  });

  const markFailedMutation = useMutation({
    mutationFn: (transactionId: number) =>
      postMarkSubscriptionTransactionFailed({ transactionId }),
    onMutate: (transactionId) => {
      setMarkingFailedId(transactionId);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      queryClient.invalidateQueries({
        queryKey: ["admin", "subscription-transactions"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to mark transaction as failed"
      );
    },
    onSettled: () => {
      setMarkingFailedId(null);
    },
  });

  const handleReconcile = (transactionId: number) => {
    reconcileMutation.mutate(transactionId);
  };

  const handleMarkAsFailed = (transactionId: number) => {
    markFailedMutation.mutate(transactionId);
  };

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "__all",
    plan: "__all",
  });

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const plans = useMemo(() => {
    if (!transactions) return [];
    const planSet = new Set<string>();
    transactions.forEach((t) => planSet.add(t.planName));
    return Array.from(planSet).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = t.teacherName.toLowerCase().includes(searchLower);
        const emailMatch =
          t.teacherEmail?.toLowerCase().includes(searchLower) ?? false;
        if (!nameMatch && !emailMatch) return false;
      }
      if (filters.status !== "__all" && t.status !== filters.status) {
        return false;
      }
      if (filters.plan !== "__all" && t.planName !== filters.plan) {
        return false;
      }
      return true;
    });
  }, [transactions, filters]);

  const { sorted: sortedTransactions, ...sortState } = useTableSort(filteredTransactions, SORT_ACCESSORS);
  const sort = {
    ...sortState,
    toggleSort: (column: Parameters<typeof sortState.toggleSort>[0]) => {
      sortState.toggleSort(column);
      setCurrentPage(1);
    },
  };

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedTransactions.slice(start, start + PAGE_SIZE);
  }, [sortedTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE);

  const formatCurrency = (amount: number): string =>
    `₹${amount.toLocaleString("en-IN")}`;

  const renderActions = (t: SubscriptionTransactionItem) => (
    <div className={styles.rowActions}>
      {t.status === "completed" && t.amount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              aria-label={`Download invoice for transaction #${t.id}`}
              onClick={() => handleDownloadInvoice(t.id)}
              disabled={downloadingInvoiceId === t.id}
            >
              {downloadingInvoiceId === t.id ? <Loader2 className={styles.spinner} /> : <Download />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download invoice</TooltipContent>
        </Tooltip>
      )}
      {t.status === "pending" && t.transactionId && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.iconButton}
                aria-label={`Reconcile transaction #${t.id}`}
                onClick={() => handleReconcile(t.id)}
                disabled={reconcilingId === t.id || markingFailedId === t.id}
              >
                {reconcilingId === t.id ? <Loader2 className={styles.spinner} /> : <RefreshCw />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reconcile transaction</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                aria-label={`Mark transaction #${t.id} as failed`}
                onClick={() => handleMarkAsFailed(t.id)}
                disabled={markingFailedId === t.id || reconcilingId === t.id}
              >
                {markingFailedId === t.id ? <Loader2 className={styles.spinner} /> : <Ban />}
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
                {Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <TransactionCardSkeleton key={i} />)}
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

    if (!transactions || transactions.length === 0) {
      return <ConsoleListEmpty icon={<Receipt size={24} />} title="No subscription transactions found" />;
    }

    if (filteredTransactions.length === 0) {
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
                <SortableTh column="id" sort={sort}>Transaction</SortableTh>
                <SortableTh column="date" sort={sort}>Date</SortableTh>
                <SortableTh column="teacher" sort={sort}>Teacher</SortableTh>
                <SortableTh column="plan" sort={sort}>Plan</SortableTh>
                <SortableTh column="amount" sort={sort} className={styles.num}>Amount</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>#{t.id}</span>
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
                  <td className={styles.num}>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{formatCurrency(t.amount)}</span>
                      <span className={styles.secondaryLine} title={t.paymentMethod || undefined}>
                        {t.paymentMethod || "No method"}
                      </span>
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
                <div className={styles.cardStat}><dt>Amount</dt><dd>{formatCurrency(t.amount)}</dd></div>
                <div className={styles.cardStat}><dt>Method</dt><dd>{t.paymentMethod || "No method"}</dd></div>
                <div className={styles.cardStat}>
                  <dt>Date</dt>
                  <dd>{t.transactionDate ? `${formatDay(t.transactionDate)}, ${formatTime(t.transactionDate)}` : "Not recorded"}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Transaction ID</dt>
                  <dd>{t.transactionId || "No transaction ID"}</dd>
                </div>
                {t.paymentFailure && (
                  <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                    <dt>Reason</dt>
                    <dd><PaymentFailureReason failure={t.paymentFailure} variant="card" /></dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  const totalCount = transactions?.length ?? 0;
  const filteredCount = filteredTransactions.length;
  const showingFiltered = totalCount !== filteredCount && totalCount > 0;

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
    <div className={`${styles.container} ${className ?? ""}`}>
      <FilterSection
        filters={filters}
        onFilterChange={handleFilterChange}
        plans={plans}
      />

      {!isFetching && transactions && transactions.length > 0 && (
        <div className={styles.resultsCount}>
          <p>
            Showing <strong>{filteredCount > 0 ? startItem : 0}-{endItem}</strong> of{" "}
            <strong>{filteredCount}</strong> transactions
            {showingFiltered && ` (filtered from ${totalCount})`}
          </p>
          <div className={styles.headerActions}>
            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <FileSpreadsheet size={16} />
              Download CSV
            </Button>
            <Button
              onClick={handleDownloadAllInvoicesZip}
              variant="outline"
              size="sm"
              disabled={isDownloadingZip}
            >
              {isDownloadingZip ? (
                <Loader2 size={16} className={styles.spinner} />
              ) : (
                <Archive size={16} />
              )}
              Download All Invoices (ZIP)
            </Button>
          </div>
        </div>
      )}

      <div className={styles.results}>{renderContent()}</div>
      {renderPagination()}
    </div>
  );
};
