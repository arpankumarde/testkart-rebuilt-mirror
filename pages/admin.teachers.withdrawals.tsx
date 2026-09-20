import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Wallet,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

import { useAdminWithdrawalsQuery, useProcessWithdrawalMutation } from "../helpers/useAdminWithdrawalsQuery";
import { useDebounce } from "../helpers/useDebounce";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
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
import { Badge } from "../components/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { SortableTh } from "../components/SortableTh";
import type { SortOrder } from "../helpers/useTableSort";
import { AdminWithdrawalRecord, TeacherWithdrawalSortColumn } from "../endpoints/admin/withdrawals/list_GET.schema";
import { BankVerificationStatus, WithdrawalStatus, WithdrawalStatusArrayValues } from "../helpers/schema";
import { AdminBankDetails } from "../components/AdminBankDetails";

import styles from "./admin.teachers.withdrawals.module.css";

// Schema for the process form
const processSchema = z.object({
  transactionId: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // If we are rejecting (handled in component logic), notes might be required. 
  // But since we reuse the schema, we'll handle specific validation logic in the submit handler or separate schemas if needed.
  // For now, basic optional fields are fine, we'll enforce 'notes' requirement for rejection in the UI/submit handler.
  return true;
});

type ProcessFormValues = z.infer<typeof processSchema>;

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY_STATES: Record<WithdrawalStatus, { title: string; description: string }> = {
  pending: { title: "No pending requests", description: "Payout requests from teachers arrive here for approval." },
  completed: { title: "No completed payouts yet", description: "Approved payouts show up here." },
  failed: { title: "No rejected requests", description: "Requests you reject show up here with the reason." },
  cancelled: { title: "No cancelled requests", description: "Requests that were cancelled show up here." },
};

/* Text starts A to Z; money starts with the largest. */
const FIRST_SORT_ORDER: Record<TeacherWithdrawalSortColumn, SortOrder> = {
  name: "asc",
  amount: "desc",
  balance: "desc",
  status: "asc",
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colAmount} />
    <col className={styles.colWallet} />
    <col className={styles.colBank} />
    <col className={styles.colStatus} />
    <col className={styles.colNotes} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom, end = false }: { top: string; bottom: string; end?: boolean }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top, marginLeft: end ? "auto" : undefined }} />
    <Skeleton style={{ height: "0.75rem", width: bottom, marginLeft: end ? "auto" : undefined }} />
  </div>
);

const WithdrawalRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="60%" bottom="80%" /></td>
    <td><StackSkeleton top="4.5rem" bottom="4rem" end /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "4.5rem", marginLeft: "auto" }} /></td>
    <td><StackSkeleton top="70%" bottom="85%" /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "4.5rem" }} /></td>
    <td><StackSkeleton top="75%" bottom="60%" /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "4rem", marginLeft: "auto" }} /></td>
  </tr>
);

const WithdrawalCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4.25rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const getStatusConfig = (
  status: WithdrawalStatus
): { label: string; variant: "success" | "warning" | "destructive" | "outline" } => {
  switch (status) {
    case "completed":
      return { label: "Completed", variant: "success" };
    case "pending":
      return { label: "Pending", variant: "warning" };
    case "failed":
      return { label: "Rejected", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelled", variant: "outline" };
    default:
      return { label: status, variant: "warning" };
  }
};

const StatusFlag = ({ status }: { status: WithdrawalStatus }) => {
  const config = getStatusConfig(status);
  return (
    <Badge variant={config.variant} className={styles.flag}>
      {config.label}
    </Badge>
  );
};

const bankStatusBadgeVariant = (
  status: BankVerificationStatus | null
): "success" | "destructive" | "warning" => {
  if (status === "verified") return "success";
  if (status === "rejected") return "destructive";
  return "warning";
};

/* The payee's account, unmasked, for the admin to check before paying. */
const PayoutBankDetails = ({ withdrawal }: { withdrawal: AdminWithdrawalRecord }) => {
  if (!withdrawal.bankAccountNumber && !withdrawal.bankUpiId) {
    return <p className={styles.bankMissing}>No bank details added</p>;
  }

  const status = withdrawal.bankVerificationStatus ?? "pending";

  return (
    <section className={styles.dialogBlock}>
      <h3 className={styles.dialogBlockTitle}>Bank details</h3>
      <dl className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <dt>Account holder</dt>
          <dd>{withdrawal.bankAccountHolderName || "Not given"}</dd>
        </div>
        <div className={styles.infoItem}>
          <dt>Account number</dt>
          <dd>{withdrawal.bankAccountNumber || "Not given"}</dd>
        </div>
        <div className={styles.infoItem}>
          <dt>IFSC code</dt>
          <dd>{withdrawal.bankIfscCode || "Not given"}</dd>
        </div>
        <div className={styles.infoItem}>
          <dt>Bank</dt>
          <dd>{withdrawal.bankName || "Not given"}</dd>
        </div>
        {withdrawal.bankUpiId && (
          <div className={styles.infoItem}>
            <dt>UPI ID</dt>
            <dd>{withdrawal.bankUpiId}</dd>
          </div>
        )}
        <div className={styles.infoItem}>
          <dt>Verification</dt>
          <dd>
            <Badge variant={bankStatusBadgeVariant(withdrawal.bankVerificationStatus)}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </dd>
        </div>
      </dl>
    </section>
  );
};

const AdminWithdrawalsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { searchParams, read, write } = useListUrlParams();
  const statusFilter = read<WithdrawalStatus>("status", WithdrawalStatusArrayValues, "pending");
  
  // Dialog state
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawalRecord | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [sortBy, setSortBy] = useState<TeacherWithdrawalSortColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, isFetching, isError, error, refetch } = useAdminWithdrawalsQuery({
    page,
    limit: 20,
    search: debouncedSearchTerm,
    status: statusFilter,
    ...(sortBy ? { sortBy, sortOrder } : {}),
  });
  useRefetchOnLinkArrival(searchParams.has("status"), isFetching, refetch);

  const toggleSort = (column: TeacherWithdrawalSortColumn) => {
    setPage(1);
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder(FIRST_SORT_ORDER[column]);
  };
  const sort = { sortBy, sortOrder, toggleSort };

  const processMutation = useProcessWithdrawalMutation();

  const form = useForm<ProcessFormValues>({
    resolver: zodResolver(processSchema),
    defaultValues: {
      transactionId: "",
      notes: "",
    },
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  const handleStatusChange = (value: string) => {
    setPage(1);
    write({ status: value === "pending" ? null : value });
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (selectedWithdrawal) {
      form.reset({
        transactionId: "",
        notes: "",
      });
    }
  }, [selectedWithdrawal, form]);

  const handleOpenProcessDialog = (withdrawal: AdminWithdrawalRecord, action: "approve" | "reject") => {
    setSelectedWithdrawal(withdrawal);
    setActionType(action);
  };

  const handleProcessSubmit = (values: ProcessFormValues) => {
    if (!selectedWithdrawal || !actionType) return;

    // Validation for rejection
    if (actionType === "reject" && !values.notes?.trim()) {
      form.setError("notes", { message: "Give a reason - the teacher sees it." });
      return;
    }

    processMutation.mutate(
      {
        withdrawalId: selectedWithdrawal.id,
        action: actionType,
        transactionId: values.transactionId,
        notes: values.notes,
      },
      {
        onSuccess: () => {
          toast.success(actionType === "approve" ? "Payout approved." : "Payout rejected. The teacher has been notified.");
          setSelectedWithdrawal(null);
          setActionType(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Could not process this request.");
        },
      }
    );
  };

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date: Date | null | string) => {
    if (!date) return "-";
    return format(new Date(date), "MMM d, yyyy");
  };

  const formatBalance = (balance: number | null) => (balance === null ? "Not recorded" : formatCurrency(balance));

  const renderIdentity = (withdrawal: AdminWithdrawalRecord, withStatus = false) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine}>
        <span className={styles.truncate} title={withdrawal.teacherName}>{withdrawal.teacherName}</span>
        {withStatus && <StatusFlag status={withdrawal.status} />}
      </span>
      {withdrawal.teacherEmail && (
        <span className={styles.secondaryLine} title={withdrawal.teacherEmail}>{withdrawal.teacherEmail}</span>
      )}
    </div>
  );

  const renderBalanceAtRequest = (withdrawal: AdminWithdrawalRecord) => {
    if (withdrawal.balanceAtRequest === null) {
      return <span className={styles.emptyLine}>Not recorded</span>;
    }
    const balance = formatCurrency(withdrawal.balanceAtRequest);
    return <span className={styles.valueLine} title={`Balance at request: ${balance}`}>{balance}</span>;
  };

  const renderNotes = (withdrawal: AdminWithdrawalRecord) => {
    if (!withdrawal.transactionId && !withdrawal.notes) {
      return <span className={styles.emptyLine}>-</span>;
    }
    return (
      <div className={styles.stack}>
        {withdrawal.transactionId && (
          <span className={styles.valueLine} title={`Transaction ID: ${withdrawal.transactionId}`}>
            {withdrawal.transactionId}
          </span>
        )}
        {withdrawal.notes && (
          <span className={styles.secondaryLine} title={withdrawal.notes}>{withdrawal.notes}</span>
        )}
      </div>
    );
  };

  const renderActions = (withdrawal: AdminWithdrawalRecord) => {
    if (withdrawal.status !== "pending") return null;
    return (
      <div className={styles.rowActions}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              aria-label={`Approve payout to ${withdrawal.teacherName}`}
              onClick={() => handleOpenProcessDialog(withdrawal, "approve")}
            >
              <CheckCircle2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Approve</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Reject payout to ${withdrawal.teacherName}`}
              onClick={() => handleOpenProcessDialog(withdrawal, "reject")}
            >
              <XCircle />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reject</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <WithdrawalRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <WithdrawalCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the withdrawal requests"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.withdrawals.length === 0) {
      if (debouncedSearchTerm !== "") {
        return (
          <ConsoleListEmpty
            icon={<Wallet size={24} />}
            title="No requests match this search"
            description="Nothing in this tab matches. Try another name or email, or check the other tabs."
          >
            <Button variant="outline" onClick={() => setSearchTerm("")}>
              Clear search
            </Button>
          </ConsoleListEmpty>
        );
      }
      const empty = EMPTY_STATES[statusFilter];
      return <ConsoleListEmpty icon={<Wallet size={24} />} title={empty.title} description={empty.description} />;
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="name" sort={sort}>Teacher</SortableTh>
                <SortableTh column="amount" sort={sort} className={styles.num}>Amount</SortableTh>
                <SortableTh column="balance" sort={sort} className={styles.num}>Balance at request</SortableTh>
                <th>Bank account</th>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <th>Notes</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id}>
                  <td>{renderIdentity(withdrawal)}</td>
                  <td className={styles.num}>
                    <div className={styles.stack}>
                      <span className={`${styles.valueLine} ${styles.amountLine}`} title={formatCurrency(withdrawal.amount)}>
                        {formatCurrency(withdrawal.amount)}
                      </span>
                      <span className={styles.secondaryLine} title={`Requested ${formatDate(withdrawal.requestedDate)}`}>
                        {formatDate(withdrawal.requestedDate)}
                      </span>
                    </div>
                  </td>
                  <td className={styles.num}>{renderBalanceAtRequest(withdrawal)}</td>
                  <td>
                    <AdminBankDetails {...withdrawal} variant="table" />
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <StatusFlag status={withdrawal.status} />
                      {withdrawal.processedDate && (
                        <span className={styles.secondaryLine} title={`Processed ${formatDate(withdrawal.processedDate)}`}>
                          {formatDate(withdrawal.processedDate)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{renderNotes(withdrawal)}</td>
                  <td>{renderActions(withdrawal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {data.withdrawals.map((withdrawal) => (
            <article key={withdrawal.id} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderIdentity(withdrawal, true)}
                {renderActions(withdrawal)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Amount</dt>
                  <dd>{formatCurrency(withdrawal.amount)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Balance at request</dt>
                  <dd>{formatBalance(withdrawal.balanceAtRequest)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Requested</dt>
                  <dd>{formatDate(withdrawal.requestedDate)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Processed</dt>
                  <dd>{formatDate(withdrawal.processedDate)}</dd>
                </div>
                {withdrawal.transactionId && (
                  <div className={styles.cardStat}>
                    <dt>Transaction ID</dt>
                    <dd>{withdrawal.transactionId}</dd>
                  </div>
                )}
                {withdrawal.notes && (
                  <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                    <dt>Internal notes</dt>
                    <dd className={styles.cardNote}>{withdrawal.notes}</dd>
                  </div>
                )}
                <div className={`${styles.cardStat} ${styles.cardStatWide}`}>
                  <dt>Bank details</dt>
                  <dd>
                    <AdminBankDetails {...withdrawal} variant="card" />
                  </dd>
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
        <title>Withdrawal requests - Testkart Admin</title>
        <meta name="description" content="Teacher payout requests awaiting approval." />
      </Helmet>
      
      <div className={styles.page}>
        <ConsolePageHeader title="Withdrawal requests" />

        <ConsoleListToolbar
          tabs={STATUS_TABS}
          value={statusFilter}
          onValueChange={handleStatusChange}
          tabsLabel="Request status"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by teacher",
            label: "Search withdrawal requests",
          }}
        />

        <div className={styles.results}>{renderContent()}</div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <Dialog 
        open={!!selectedWithdrawal} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWithdrawal(null);
            setActionType(null);
          }
        }}
      >
        <ConsoleDialogContent size="md">
          <ConsoleDialogHeader
            title={actionType === "approve" ? "Approve this payout?" : "Reject this payout?"}
            description={
              actionType === "reject"
                ? "This request will not be paid. Say why below - the teacher sees it."
                : "Check the amount and bank account before you approve."
            }
            icon={actionType === "reject" ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
            tone={actionType === "reject" ? "destructive" : "default"}
          />

          <form onSubmit={form.handleSubmit(handleProcessSubmit)}>
            <ConsoleDialogBody>
              {selectedWithdrawal && (
                <>
                  <section className={styles.dialogBlock}>
                    <h3 className={styles.dialogBlockTitle}>Payout</h3>
                    <dl className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <dt>Teacher</dt>
                        <dd>{selectedWithdrawal.teacherName}</dd>
                      </div>
                      <div className={styles.infoItem}>
                        <dt>Amount</dt>
                        <dd className={styles.infoAmount}>{formatCurrency(selectedWithdrawal.amount)}</dd>
                      </div>
                      {actionType === "approve" && (
                        <div className={styles.infoItem}>
                          <dt>Balance at request</dt>
                          <dd>{formatBalance(selectedWithdrawal.balanceAtRequest)}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                  <PayoutBankDetails withdrawal={selectedWithdrawal} />
                </>
              )}

              {actionType === "approve" && (
                <div className={styles.formGroup}>
                  <label htmlFor="transactionId">Transaction ID</label>
                  <Input
                    id="transactionId"
                    placeholder="BANK12345678"
                    {...form.register("transactionId")}
                  />
                  <p className={styles.helperText}>The bank reference number, if you have it.</p>
                </div>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="notes">
                  {actionType === "reject" ? "Reason" : "Internal notes"}
                </label>
                <textarea
                  id="notes"
                  className={styles.textarea}
                  rows={3}
                  placeholder={actionType === "reject" ? "The bank details do not match the PAN on file" : "Only the team sees these"}
                  {...form.register("notes")}
                />
                {form.formState.errors.notes && (
                  <p className={styles.errorMessage}>{form.formState.errors.notes.message}</p>
                )}
              </div>
            </ConsoleDialogBody>

            <ConsoleDialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                variant={actionType === "reject" ? "destructive" : "primary"}
                disabled={processMutation.isPending}
              >
                {processMutation.isPending
                  ? (actionType === "approve" ? "Approving..." : "Rejecting...")
                  : (actionType === "approve" ? "Approve payout" : "Reject payout")}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </ConsoleDialogContent>
      </Dialog>
    </>
  );
};

export default AdminWithdrawalsPage;
