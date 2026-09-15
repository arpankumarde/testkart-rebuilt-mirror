import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Plus
} from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ConsoleFilterNotice } from "./ConsoleFilterNotice";
import { WithdrawalRequestDialog } from "./WithdrawalRequestDialog";
import { useTeacherWithdrawals } from "../helpers/useTeacherWithdrawalQuery";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { WithdrawalStatus } from "../helpers/schema";
import styles from "./TeacherWithdrawalSection.module.css";

const LIST_FILTERS = ["pending-withdrawals"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

interface TeacherWithdrawalSectionProps {
  availableBalance: number;
  isBankDetailsVerified: boolean;
  isLoadingBalance: boolean;
  /* True while panels above this one are still loading, so the arrival scroll waits for them. */
  isLayoutPending?: boolean;
}

const StatusBadge = ({ status }: { status: WithdrawalStatus }) => {
  switch (status) {
    case "pending":
      return (
        <span className={`${styles.badge} ${styles.badgePending}`}>
          <Clock size={12} /> Pending
        </span>
      );
    case "completed":
      return (
        <span className={`${styles.badge} ${styles.badgeCompleted}`}>
          <CheckCircle size={12} /> Completed
        </span>
      );
    case "failed":
    case "cancelled":
      return (
        <span className={`${styles.badge} ${styles.badgeFailed}`}>
          <XCircle size={12} /> {status === "failed" ? "Failed" : "Cancelled"}
        </span>
      );
    default:
      return <span className={styles.badge}>{status}</span>;
  }
};

export const TeacherWithdrawalSection: React.FC<TeacherWithdrawalSectionProps> = ({
  availableBalance,
  isBankDetailsVerified,
  isLoadingBalance,
  isLayoutPending = false,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: withdrawalData, isFetching: isFetchingHistory, refetch: refetchHistory } = useTeacherWithdrawals();
  const { read, write } = useListUrlParams();
  const pendingOnly = read<ListFilter | "none">("filter", LIST_FILTERS, "none") === "pending-withdrawals";
  useRefetchOnLinkArrival(pendingOnly, isFetchingHistory, refetchHistory);

  const allWithdrawals = withdrawalData?.withdrawals || [];
  const withdrawals = pendingOnly
    ? allWithdrawals.filter((withdrawal) => withdrawal.status === "pending")
    : allWithdrawals;

  // The dashboard's withdrawals tile lands on this filter. The section sits
  // below the balance and bank panels, so bring it into view once, after the
  // panels above have settled their height.
  const cardRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const isSettled = !isFetchingHistory && !isLoadingBalance && !isLayoutPending;
  useEffect(() => {
    if (!pendingOnly || !isSettled || hasScrolled.current) return;
    hasScrolled.current = true;
    cardRef.current?.scrollIntoView({ block: "start" });
  }, [pendingOnly, isSettled]);

  return (
    <div id="withdrawals" ref={cardRef} className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>Withdraw Funds</h2>
          <p className={styles.subtitle}>
            Manage your earnings and request withdrawals
          </p>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.balanceSection}>
          <div className={styles.balanceInfo}>
            <span className={styles.balanceLabel}>Available for Withdrawal</span>
            {isLoadingBalance ? (
              <Skeleton style={{ width: "120px", height: "2rem" }} />
            ) : (
              <span className={styles.balanceValue}>
                ₹{availableBalance.toFixed(2)}
              </span>
            )}
          </div>
          
          <Button 
            onClick={() => setIsDialogOpen(true)}
            disabled={!isBankDetailsVerified || availableBalance < 100 || isLoadingBalance}
          >
            <Plus size={16} /> Request Withdrawal
          </Button>
        </div>

        {!isBankDetailsVerified && (
          <div className={styles.warningBox}>
            <AlertCircle size={16} />
            <span>
              You must have <strong>verified bank details</strong> to request a withdrawal. 
              Please add or update your bank details above.
            </span>
          </div>
        )}

        <div className={styles.historySection}>
          <h3 className={styles.historyTitle}>Recent Requests</h3>

          {pendingOnly && (
            <ConsoleFilterNotice
              label="Withdrawal requests being processed"
              count={withdrawalData ? withdrawals.length : undefined}
              onClear={() => write({ filter: null })}
              clearLabel="Show all"
            />
          )}

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {isFetchingHistory ? (
                   Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton style={{ width: "80px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "60px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "80px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "100px", height: "1.25rem" }} /></td>
                    </tr>
                  ))
                ) : withdrawals.length > 0 ? (
                  withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id}>
                      <td>
                        {withdrawal.requestedDate
                          ? format(new Date(withdrawal.requestedDate), "MMM dd, yyyy")
                          : "-"}
                      </td>
                      <td className={styles.amount}>₹{withdrawal.amount.toFixed(2)}</td>
                      <td>
                        <StatusBadge status={withdrawal.status as WithdrawalStatus} />
                      </td>
                      <td className={styles.notes}>
                        {withdrawal.notes || "-"}
                        {withdrawal.status === 'failed' &&  (
                           <span className={styles.failureReason}> (Check Bank Details)</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className={styles.emptyState}>
                      {pendingOnly
                        ? "No withdrawal requests are being processed."
                        : "No withdrawal requests yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <WithdrawalRequestDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        availableBalance={availableBalance}
      />
    </div>
  );
};