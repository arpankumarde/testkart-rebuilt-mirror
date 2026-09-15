import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminEarningsQuery } from "../helpers/useAdminEarnings";
import { useAddWithdrawalMutation } from "../helpers/useAdminWithdrawal";
import { useDebounce } from "../helpers/useDebounce";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import {
  Dialog,
  DialogClose,
} from "../components/Dialog";
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from "../components/ConsoleDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import {
  Wallet,
  IndianRupee,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Banknote,
} from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { toast } from "sonner";
import { TeacherEarningAdminView } from "../endpoints/admin/earnings/list_GET.schema";
import { schema as addWithdrawalSchema } from "../endpoints/admin/earnings/add-withdrawal_POST.schema";
import styles from "./admin.teachers.earnings.module.css";

type SortableColumn =
  | "name"
  | "email"
  | "totalEarnings"
  | "totalWithdrawals"
  | "totalPrizeDeductions"
  | "totalSubscriptionWalletPayments"
  | "pendingWithdrawals"
  | "availableBalance"
  | "transactionsCount";

const SORTABLE_COLUMNS: { value: SortableColumn; label: string }[] = [
  { value: "name", label: "Teacher" },
  { value: "email", label: "Email" },
  { value: "totalEarnings", label: "Earned" },
  { value: "totalWithdrawals", label: "Withdrawn" },
  { value: "totalPrizeDeductions", label: "Prizes paid" },
  { value: "totalSubscriptionWalletPayments", label: "Subscription" },
  { value: "pendingWithdrawals", label: "Pending" },
  { value: "availableBalance", label: "Available" },
  { value: "transactionsCount", label: "Transactions" },
];

/* The balance columns between Earned and Available, in table order. */
const LEDGER_FIELDS = [
  { key: "totalWithdrawals", label: "Withdrawn" },
  { key: "totalPrizeDeductions", label: "Prizes paid" },
  { key: "totalSubscriptionWalletPayments", label: "Subscription" },
  { key: "pendingWithdrawals", label: "Pending" },
] as const;

const defaultSortOrder = (col: SortableColumn): "asc" | "desc" => {
  if (col === "name" || col === "email") return "asc";
  return "desc";
};

const formatTransactions = (count: number): string =>
  `${count} ${count === 1 ? "transaction" : "transactions"}`;

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colEarned} />
    <col className={styles.colMoney} />
    <col className={styles.colMoney} />
    <col className={styles.colSubscription} />
    <col className={styles.colMoney} />
    <col className={styles.colAvailable} />
    <col className={styles.colActions} />
  </colgroup>
);

const EarningRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "80%" }} />
      </div>
    </td>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "5rem", marginLeft: "auto" }} />
        <Skeleton style={{ height: "0.75rem", width: "4.5rem", marginLeft: "auto" }} />
      </div>
    </td>
    {Array.from({ length: 5 }).map((_, i) => (
      <td key={i}>
        <Skeleton style={{ height: "0.875rem", width: "4.5rem", marginLeft: "auto" }} />
      </td>
    ))}
    <td>
      <Skeleton style={{ height: "1.5rem", width: "1.5rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const EarningCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "2rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

interface SortIconProps {
  column: SortableColumn;
  sortBy: SortableColumn;
  sortOrder: "asc" | "desc";
}

const SortIcon = ({ column, sortBy, sortOrder }: SortIconProps) => {
  if (sortBy !== column) {
    return <ArrowUpDown className={styles.sortIcon} aria-hidden="true" />;
  }
  if (sortOrder === "asc") {
    return <ArrowUp className={`${styles.sortIcon} ${styles.sortIconActive}`} aria-hidden="true" />;
  }
  return <ArrowDown className={`${styles.sortIcon} ${styles.sortIconActive}`} aria-hidden="true" />;
};

const AdminEarningsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherEarningAdminView | null>(null);
  const [sortBy, setSortBy] = useState<SortableColumn>("totalEarnings");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, isFetching, isError, error, refetch } = useAdminEarningsQuery({
    page,
    search: debouncedSearchTerm,
    sortBy,
    sortOrder,
  });

  const addWithdrawalMutation = useAddWithdrawalMutation();

  const formSchema = addWithdrawalSchema.extend({
    amount: z.coerce.number()
      .positive("Enter an amount above zero.")
      .max(selectedTeacher?.availableBalance ?? 0, "This is more than the teacher has available."),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      transactionId: "",
      notes: "",
    },
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setPage(1);
  }, [sortBy, sortOrder]);

  useEffect(() => {
    if (selectedTeacher) {
      form.reset({
        teacherId: selectedTeacher.teacherId,
        amount: 0,
        transactionId: "",
        notes: "",
      });
    }
  }, [selectedTeacher, form]);

  const handleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder(defaultSortOrder(column));
    }
  };

  const handleAddWithdrawal = (values: FormValues) => {
    if (!selectedTeacher) return;
    addWithdrawalMutation.mutate(
      { ...values, teacherId: selectedTeacher.teacherId },
      {
        onSuccess: () => {
          toast.success("Payout recorded.");
          setSelectedTeacher(null);
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : "Could not record the payout.";
          toast.error(message);
        },
      }
    );
  };

  /* Two fixed decimals: this is a payout ledger, so paise stay exact and the
     columns line up. */
  const formatCurrency = (amount: number): string =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const zeroClass = (amount: number) => (amount === 0 ? styles.zero : "");

  const availableClass = (amount: number) => (amount > 0 ? styles.positiveBalance : styles.zero);

  const renderSortableHeader = (column: SortableColumn, label: string, numeric = false) => {
    const isActive = sortBy === column;
    return (
      <th
        key={column}
        className={numeric ? styles.num : undefined}
        aria-sort={isActive ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      >
        <button type="button" className={styles.sortButton} onClick={() => handleSort(column)}>
          {label}
          <SortIcon column={column} sortBy={sortBy} sortOrder={sortOrder} />
        </button>
      </th>
    );
  };

  const renderIdentity = (teacher: TeacherEarningAdminView) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine} title={teacher.teacherName}>{teacher.teacherName}</span>
      {teacher.teacherEmail && (
        <span className={styles.secondaryLine} title={teacher.teacherEmail}>{teacher.teacherEmail}</span>
      )}
    </div>
  );

  const renderActions = (teacher: TeacherEarningAdminView) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`Record payout to ${teacher.teacherName}`}
            onClick={() => setSelectedTeacher(teacher)}
          >
            <Banknote />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Record payout</TooltipContent>
      </Tooltip>
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
                {Array.from({ length: 10 }).map((_, i) => <EarningRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <EarningCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the earnings"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.earnings.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Wallet size={24} />}
          title={debouncedSearchTerm ? "No teachers match that search" : "No earnings yet"}
          description={
            debouncedSearchTerm
              ? `Nothing found for "${debouncedSearchTerm}". Try a different name or email.`
              : "Once teachers start selling, their balances appear here."
          }
        >
          {debouncedSearchTerm && (
            <Button variant="outline" onClick={() => setSearchTerm("")}>Clear search</Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                {renderSortableHeader("name", "Teacher")}
                {renderSortableHeader("totalEarnings", "Earned", true)}
                {LEDGER_FIELDS.map((field) => renderSortableHeader(field.key, field.label, true))}
                {renderSortableHeader("availableBalance", "Available", true)}
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.earnings.map((teacher) => (
                <tr key={teacher.teacherId}>
                  <td>{renderIdentity(teacher)}</td>
                  <td className={styles.num}>
                    <div className={styles.stack}>
                      <span
                        className={`${styles.valueLine} ${zeroClass(teacher.totalEarnings)}`}
                        title={formatCurrency(teacher.totalEarnings)}
                      >
                        {formatCurrency(teacher.totalEarnings)}
                      </span>
                      <span className={styles.secondaryLine}>{formatTransactions(teacher.transactionsCount)}</span>
                    </div>
                  </td>
                  {LEDGER_FIELDS.map((field) => (
                    <td
                      key={field.key}
                      className={`${styles.num} ${zeroClass(teacher[field.key])}`}
                      title={formatCurrency(teacher[field.key])}
                    >
                      {formatCurrency(teacher[field.key])}
                    </td>
                  ))}
                  <td
                    className={`${styles.num} ${availableClass(teacher.availableBalance)}`}
                    title={formatCurrency(teacher.availableBalance)}
                  >
                    {formatCurrency(teacher.availableBalance)}
                  </td>
                  <td>{renderActions(teacher)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.earnings.map((teacher) => (
            <article key={teacher.teacherId} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderIdentity(teacher)}
                {renderActions(teacher)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Available</dt>
                  <dd className={availableClass(teacher.availableBalance)}>{formatCurrency(teacher.availableBalance)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Earned</dt>
                  <dd className={zeroClass(teacher.totalEarnings)}>{formatCurrency(teacher.totalEarnings)}</dd>
                </div>
                {LEDGER_FIELDS.map((field) => (
                  <div key={field.key} className={styles.cardStat}>
                    <dt>{field.label}</dt>
                    <dd className={zeroClass(teacher[field.key])}>{formatCurrency(teacher[field.key])}</dd>
                  </div>
                ))}
                <div className={styles.cardStat}>
                  <dt>Transactions</dt>
                  <dd className={zeroClass(teacher.transactionsCount)}>{teacher.transactionsCount}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Teacher earnings - Testkart Admin</title>
        <meta name="description" content="Teacher balances and payouts on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Teacher earnings" />

        <ConsoleListToolbar
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by name or email",
            label: "Search teacher earnings",
          }}
        >
          <Select
            value={sortBy}
            onValueChange={(val) => {
              const col = val as SortableColumn;
              setSortBy(col);
              setSortOrder(defaultSortOrder(col));
            }}
          >
            <SelectTrigger className={consoleToolbarControlClass} aria-label="Sort teacher earnings by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORTABLE_COLUMNS.map((col) => (
                <SelectItem key={col.value} value={col.value}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-lg"
            className={`${styles.iconButton} ${styles.sortDirection}`}
            aria-label={sortOrder === "asc" ? "Sort descending" : "Sort ascending"}
            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
          >
            {sortOrder === "asc" ? <ArrowUp /> : <ArrowDown />}
          </Button>
        </ConsoleListToolbar>

        <div className={styles.results}>{renderContent()}</div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <Dialog open={!!selectedTeacher} onOpenChange={(open) => !open && setSelectedTeacher(null)}>
        <ConsoleDialogContent size="md">
          <ConsoleDialogHeader
            title={`Record a payout to ${selectedTeacher?.teacherName ?? ""}`}
            description="This records money you have already sent."
            icon={<Wallet size={20} />}
          />
          <form onSubmit={form.handleSubmit(handleAddWithdrawal)}>
            <ConsoleDialogBody>
              <div className={styles.balanceSummary}>
                <span className={styles.summaryLabel}>Available balance</span>
                <span className={styles.summaryFigure}>
                  {formatCurrency(selectedTeacher?.availableBalance ?? 0)}
                </span>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="amount">Amount</label>
                <div className={styles.amountInputContainer}>
                  <IndianRupee size={16} className={styles.rupeeIcon} />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...form.register("amount")}
                    className={styles.amountInput}
                  />
                </div>
                {form.formState.errors.amount && (
                  <p className={styles.errorMessage}>{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="transactionId">Transaction ID</label>
                <Input
                  id="transactionId"
                  type="text"
                  placeholder="PAYOUT_12345"
                  {...form.register("transactionId")}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="notes">Internal notes</label>
                <textarea
                  id="notes"
                  placeholder="Only the team sees these"
                  {...form.register("notes")}
                  className={styles.textarea}
                  rows={3}
                />
              </div>
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={addWithdrawalMutation.isPending}>
                {addWithdrawalMutation.isPending ? "Saving..." : "Record payout"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </ConsoleDialogContent>
      </Dialog>
    </>
  );
};

export default AdminEarningsPage;
