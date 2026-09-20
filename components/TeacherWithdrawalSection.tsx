import React, { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { ConsoleFilterNotice } from "./ConsoleFilterNotice";
import { useTeacherWithdrawals } from "../helpers/useTeacherWithdrawalQuery";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { WithdrawalStatus } from "../helpers/schema";
import styles from "./TeacherWithdrawalSection.module.css";

const LIST_FILTERS = ["pending-withdrawals"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface TeacherWithdrawalSectionProps {
  /* True while panels above this one are still loading, so the arrival scroll waits for them. */
  isLayoutPending?: boolean;
}

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
          <CheckCircle size={12} aria-hidden="true" /> Completed
        </span>
      );
    case "failed":
    case "cancelled":
      return (
        <span className={`${styles.badge} ${styles.badgeFailed}`}>
          <XCircle size={12} aria-hidden="true" /> {status === "failed" ? "Failed" : "Cancelled"}
        </span>
      );
    default:
      return <span className={styles.badge}>{status}</span>;
  }
};

/*
 * The teacher's withdrawal requests. Requesting one happens from the balance
 * block at the top of Earnings, next to the figure it draws on.
 */
export const TeacherWithdrawalSection: React.FC<TeacherWithdrawalSectionProps> = ({
  isLayoutPending = false,
}) => {
  const { data: withdrawalData, isFetching: isFetchingHistory, refetch: refetchHistory } = useTeacherWithdrawals();
  const { read, write } = useListUrlParams();
  const pendingOnly = read<ListFilter | "none">("filter", LIST_FILTERS, "none") === "pending-withdrawals";
  useRefetchOnLinkArrival(pendingOnly, isFetchingHistory, refetchHistory);

  const allWithdrawals = withdrawalData?.withdrawals || [];
  const withdrawals = pendingOnly
    ? allWithdrawals.filter((withdrawal) => withdrawal.status === "pending")
    : allWithdrawals;

  // The dashboard's withdrawals tile lands on this filter. The section sits
  // below the balance and totals, so bring it into view once, after the
  // panels above have settled their height.
  const sectionRef = useRef<HTMLElement>(null);
  const hasScrolled = useRef(false);
  const isSettled = !isFetchingHistory && !isLayoutPending;
  useEffect(() => {
    if (!pendingOnly || !isSettled || hasScrolled.current) return;
    hasScrolled.current = true;
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, [pendingOnly, isSettled]);

  return (
    <section id="withdrawals" ref={sectionRef} className={styles.card} aria-labelledby="withdrawals-title">
      <h2 id="withdrawals-title" className={styles.title}>
        Withdrawals
      </h2>

      {pendingOnly && (
        <ConsoleFilterNotice
          label="Withdrawal requests being processed"
          count={withdrawalData ? withdrawals.length : undefined}
          onClear={() => write({ filter: null })}
          clearLabel="Show all"
        />
      )}

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
              <th>Notes</th>
              <th className={styles.numeric}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {isFetchingHistory ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton style={{ width: "88px", height: "1.25rem" }} /></td>
                  <td><Skeleton style={{ width: "80px", height: "1.25rem" }} /></td>
                  <td><Skeleton style={{ width: "140px", height: "1.25rem" }} /></td>
                  <td className={styles.numeric}><Skeleton style={{ width: "80px", height: "1.25rem", marginLeft: "auto" }} /></td>
                </tr>
              ))
            ) : withdrawals.length > 0 ? (
              withdrawals.map((withdrawal) => {
                const hasNotes = !!withdrawal.notes || withdrawal.status === "failed";
                return (
                  <tr key={withdrawal.id}>
                    <td className={styles.date}>
                      {withdrawal.requestedDate
                        ? format(new Date(withdrawal.requestedDate), "MMM dd, yyyy")
                        : "-"}
                    </td>
                    <td>
                      <StatusBadge status={withdrawal.status as WithdrawalStatus} />
                    </td>
                    <td className={`${styles.notes} ${hasNotes ? "" : styles.notesEmpty}`}>
                      {withdrawal.notes || (withdrawal.status === "failed" ? "" : "-")}
                      {withdrawal.status === "failed" && (
                        <span className={styles.failureReason}>Check your bank account, then request again.</span>
                      )}
                    </td>
                    <td className={`${styles.numeric} ${styles.amount}`}>{rupees.format(withdrawal.amount)}</td>
                  </tr>
                );
              })
            ) : (
              <tr className={styles.emptyRow}>
                <td colSpan={4}>
                  {pendingOnly
                    ? "No withdrawal requests are being processed."
                    : "No withdrawal requests yet. Use Withdraw at the top of this page once your balance reaches ₹100."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};