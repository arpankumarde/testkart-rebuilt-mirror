import React, { useState } from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "./Skeleton";
import { WithdrawalCancelDialog } from "./WithdrawalCancelDialog";
import { type WithdrawalRecord } from "../endpoints/student/withdrawal/list_GET.schema";
import { WithdrawalStatus } from "../helpers/schema";
import { useCancelStudentWithdrawal } from "../helpers/useStudentWithdrawals";
import styles from "./StudentWithdrawalSection.module.css";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const StatusBadge = ({ status }: { status: WithdrawalStatus }) => {
  switch (status) {
    case "pending":
      return (
        <span className={`${styles.badge} ${styles.badgePending}`}>
          <Clock size={12} aria-hidden="true" /> Pending
        </span>
      );
    case "completed":
      return (
        <span className={`${styles.badge} ${styles.badgeCompleted}`}>
          <CheckCircle size={12} aria-hidden="true" /> Paid
        </span>
      );
    case "failed":
      return (
        <span className={`${styles.badge} ${styles.badgeFailed}`}>
          <XCircle size={12} aria-hidden="true" /> Rejected
        </span>
      );
    case "cancelled":
      return (
        <span className={`${styles.badge} ${styles.badgeCancelled}`}>
          <XCircle size={12} aria-hidden="true" /> Cancelled
        </span>
      );
    default:
      return <span className={styles.badge}>{status}</span>;
  }
};

interface StudentWithdrawalSectionProps {
  withdrawals: WithdrawalRecord[];
  isLoading: boolean;
}

/*
 * The student's withdrawal requests. Requesting one happens from the balance
 * block at the top of the wallet, which also reads this list to know whether
 * one is already pending. A pending request can be cancelled from its row.
 */
export const StudentWithdrawalSection: React.FC<StudentWithdrawalSectionProps> = ({ withdrawals, isLoading }) => {
  const cancelMutation = useCancelStudentWithdrawal();
  const [cancelTarget, setCancelTarget] = useState<WithdrawalRecord | null>(null);

  const confirmCancel = () => {
    if (!cancelTarget || cancelMutation.isPending) return;
    cancelMutation.mutate(
      { withdrawalId: cancelTarget.id },
      {
        onSuccess: (cancelled) => {
          toast.success(`Withdrawal request cancelled. ${rupees.format(cancelled.amount)} is back in your available balance.`);
          setCancelTarget(null);
        },
        onError: (error) => {
          toast.error(error.message || "Could not cancel this request.");
          setCancelTarget(null);
        },
      }
    );
  };

  return (
  <section className={styles.card} aria-labelledby="withdrawals-title">
    <h2 id="withdrawals-title" className={styles.title}>Withdrawals</h2>

    <div className={styles.results}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colDate} />
          <col className={styles.colStatus} />
          <col />
          <col className={styles.colAmount} />
        </colgroup>
        <thead>
          <tr>
            <th>Requested</th>
            <th>Status</th>
            <th>Details</th>
            <th className={styles.numeric}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <tr key={i}>
                <td><Skeleton style={{ width: "88px", height: "1.25rem" }} /></td>
                <td><Skeleton style={{ width: "80px", height: "1.25rem" }} /></td>
                <td><Skeleton style={{ width: "140px", height: "1.25rem" }} /></td>
                <td className={styles.numeric}><Skeleton style={{ width: "80px", height: "1.25rem", marginLeft: "auto" }} /></td>
              </tr>
            ))
          ) : withdrawals.length > 0 ? (
            withdrawals.map((withdrawal) => {
              const isFailed = withdrawal.status === "failed";
              const isPending = withdrawal.status === "pending";
              const isCancelled = withdrawal.status === "cancelled";
              const hasDetails = !!withdrawal.notes || !!withdrawal.transactionId || isFailed || isPending || isCancelled;
              return (
                <tr key={withdrawal.id}>
                  <td className={styles.date}>
                    {withdrawal.requestedDate ? shortDate.format(new Date(withdrawal.requestedDate)) : "-"}
                  </td>
                  <td>
                    <StatusBadge status={withdrawal.status as WithdrawalStatus} />
                  </td>
                  <td className={`${styles.details} ${hasDetails ? "" : styles.detailsEmpty}`}>
                    {hasDetails && (
                      <>
                        {withdrawal.notes && <span className={styles.note}>{withdrawal.notes}</span>}
                        {withdrawal.transactionId && (
                          <span className={styles.reference}>
                            Bank reference <span className={styles.code}>{withdrawal.transactionId}</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className={styles.failureReason}>Check your bank details, then request again.</span>
                        )}
                        {isCancelled && (
                          <span className={styles.cancelledNote}>
                            {withdrawal.cancelledAt ? `Cancelled on ${shortDate.format(new Date(withdrawal.cancelledAt))}. ` : ""}
                            The amount is back in your balance.
                          </span>
                        )}
                        {isPending && (
                          <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={() => setCancelTarget(withdrawal)}
                            disabled={cancelMutation.isPending}
                            aria-label={`Cancel withdrawal request of ${rupees.format(withdrawal.amount)}`}
                          >
                            Cancel Request
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td className={`${styles.numeric} ${styles.amount}`}>{rupees.format(withdrawal.amount)}</td>
                </tr>
              );
            })
          ) : (
            <tr className={styles.emptyRow}>
              <td colSpan={4}>No withdrawals yet. Once your balance reaches ₹50, use Withdraw above.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    <WithdrawalCancelDialog
      open={!!cancelTarget}
      onOpenChange={(open) => { if (!open && !cancelMutation.isPending) setCancelTarget(null); }}
      isPending={cancelMutation.isPending}
      onConfirm={confirmCancel}
    />
  </section>
  );
};