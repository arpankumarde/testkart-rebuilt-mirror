import React from "react";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { 
  useStudentWithdrawalsList, 
  useRequestStudentWithdrawal 
} from "../helpers/useStudentWithdrawals";
import { useStudentWalletBalance } from "../helpers/useStudentWallet";
import { useStudentBankDetailsQuery } from "../helpers/useStudentBankDetails";
import { schema as withdrawalSchema, type InputType as WithdrawalInput } from "../endpoints/student/withdrawal/request_POST.schema";
import { AlertCircle, IndianRupee, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { WithdrawalStatus } from "../helpers/schema";
import styles from "./StudentWithdrawalSection.module.css";

const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateInput: string | Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateInput));
};

const StatusBadge = ({ status }: { status: WithdrawalStatus }) => {
  switch (status) {
    case "pending":
      return <Badge variant="warning"><Clock size={12} className={styles.badgeIcon} /> Pending</Badge>;
    case "completed":
      return <Badge variant="success"><CheckCircle size={12} className={styles.badgeIcon} /> Completed</Badge>;
    case "failed":
    case "cancelled":
      return <Badge variant="destructive"><XCircle size={12} className={styles.badgeIcon} /> {status}</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export const StudentWithdrawalSection: React.FC = () => {
  const { data: balanceData, isFetching: isLoadingBalance } = useStudentWalletBalance();
  const { data: bankDetails, isFetching: isLoadingBank } = useStudentBankDetailsQuery();
  const { data: withdrawalData, isFetching: isLoadingHistory } = useStudentWithdrawalsList();
  const { mutateAsync: requestWithdrawal, isPending: isRequesting } = useRequestStudentWithdrawal();

  const withdrawals = withdrawalData?.withdrawals || [];
  const availableBalance = balanceData?.availableBalance || 0;
  
  const isBankVerified = bankDetails?.verificationStatus === "verified";
  const hasPendingWithdrawal = withdrawals.some((w) => w.status === "pending");
  const canWithdraw = availableBalance >= 50 && isBankVerified && !hasPendingWithdrawal;

  const form = useForm({
    schema: withdrawalSchema,
    defaultValues: {
      amount: 50,
      notes: "",
    },
  });

  const onSubmit = async (values: WithdrawalInput) => {
    if (values.amount > availableBalance) {
      form.setFieldError("amount", "Amount exceeds available balance.");
      return;
    }

    try {
      await requestWithdrawal(values);
      toast.success("Withdrawal request submitted successfully.");
      form.setValues({ amount: 50, notes: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request.");
    }
  };

  return (
    <div className={styles.container}>
      {/* Request Section */}
      <div className={styles.requestCard}>
        <div className={styles.requestHeader}>
          <div className={styles.headerIcon}>
            <IndianRupee size={24} />
          </div>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>Request Withdrawal</h2>
            <p className={styles.subtitle}>Withdraw your prize money to your verified bank account.</p>
          </div>
        </div>

        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>Available Balance</span>
          {isLoadingBalance ? (
            <Skeleton style={{ width: "120px", height: "2rem" }} />
          ) : (
            <span className={styles.balanceValue}>{formatINR(availableBalance)}</span>
          )}
        </div>

        {!isLoadingBank && !isLoadingHistory && !canWithdraw && (
          <div className={styles.validationAlerts}>
            {!isBankVerified && (
              <div className={styles.alertItem}>
                <AlertCircle size={16} />
                <span>You must have verified bank details to request a withdrawal. Please check the Bank Details tab.</span>
              </div>
            )}
            {hasPendingWithdrawal && (
              <div className={styles.alertItem}>
                <AlertCircle size={16} />
                <span>You already have a pending withdrawal request. Please wait for it to be processed.</span>
              </div>
            )}
            {availableBalance < 50 && (
              <div className={styles.alertItem}>
                <AlertCircle size={16} />
                <span>Minimum withdrawal amount is {formatINR(50)}.</span>
              </div>
            )}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.formRow}>
              <FormItem name="amount" className={styles.amountField}>
                <FormLabel>Amount to Withdraw (₹)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="50"
                    step="0.01"
                    placeholder="Enter amount"
                    value={form.values.amount}
                    onChange={(e) => form.setValues(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    disabled={!canWithdraw || isRequesting}
                  />
                </FormControl>
                <FormDescription>Min. {formatINR(50)}</FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="notes" className={styles.notesField}>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Add an optional note"
                    value={form.values.notes || ""}
                    onChange={(e) => form.setValues(prev => ({ ...prev, notes: e.target.value }))}
                    disabled={!canWithdraw || isRequesting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>

            <Button 
              type="submit" 
              disabled={!canWithdraw || isRequesting}
              className={styles.submitButton}
            >
              {isRequesting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </Form>
      </div>

      {/* History Section */}
      <div className={styles.historySection}>
        <h3 className={styles.historyTitle}>Withdrawal History</h3>

        {isLoadingHistory ? (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Transaction ID</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton style={{ width: "90px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "80px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "80px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "120px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "100px", height: "1.25rem" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileWList}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.mobileWCard}>
                  <Skeleton style={{ width: "100%", height: "4.5rem" }} />
                </div>
              ))}
            </div>
          </>
        ) : withdrawals.length > 0 ? (
          <>
            {/* Desktop/tablet table */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Transaction ID</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id}>
                      <td className={styles.dateCell}>
                        {withdrawal.requestedDate ? formatDate(withdrawal.requestedDate) : "-"}
                      </td>
                      <td className={styles.amountCell}>{formatINR(withdrawal.amount)}</td>
                      <td>
                        <StatusBadge status={withdrawal.status as WithdrawalStatus} />
                      </td>
                      <td className={styles.txIdCell}>
                        {withdrawal.transactionId || <span className={styles.emptyDash}>-</span>}
                      </td>
                      <td className={styles.notesCell}>
                        {withdrawal.notes || "-"}
                        {withdrawal.status === 'failed' && (
                          <span className={styles.failureReason}> (Check Bank Details)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards, shown instead of the table below the sm breakpoint */}
            <div className={styles.mobileWList}>
              {withdrawals.map((withdrawal) => (
                <div key={`m-${withdrawal.id}`} className={styles.mobileWCard}>
                  <div className={styles.mobileWTopRow}>
                    <span className={styles.dateCell}>
                      {withdrawal.requestedDate ? formatDate(withdrawal.requestedDate) : "-"}
                    </span>
                    <StatusBadge status={withdrawal.status as WithdrawalStatus} />
                  </div>
                  <div className={styles.mobileWAmount}>{formatINR(withdrawal.amount)}</div>
                  {withdrawal.transactionId && (
                    <div className={styles.txIdCell}>Txn ID: {withdrawal.transactionId}</div>
                  )}
                  {(withdrawal.notes || withdrawal.status === 'failed') && (
                    <div className={styles.notesCellMobile}>
                      {withdrawal.notes || "-"}
                      {withdrawal.status === 'failed' && (
                        <span className={styles.failureReason}> (Check Bank Details)</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>No withdrawal requests found.</div>
        )}
      </div>
    </div>
  );
};