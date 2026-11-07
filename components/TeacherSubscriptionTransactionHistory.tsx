import React from "react";
import { ReceiptText } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { TeacherListPagination } from "./TeacherListPagination";
import { useSubscriptionHistoryQuery } from "../helpers/useTeacherSubscription";
import styles from "./TeacherSubscriptionTransactionHistory.module.css";

export interface TransactionHistoryProps {
  historyQuery: ReturnType<typeof useSubscriptionHistoryQuery>;
  historyPage: number;
  onPageChange: (page: number) => void;
}

const formatDate = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "-";

const formatInr = (amount: number) => {
  const rounded = Math.round(amount * 100) / 100;
  return rounded.toLocaleString(
    "en-IN",
    Number.isInteger(rounded) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`${styles.status} ${status === "completed" ? styles.paid : styles.pending}`}>
    {status === "completed" ? "Paid" : "Pending"}
  </span>
);

export const TeacherSubscriptionTransactionHistory: React.FC<TransactionHistoryProps> = ({
  historyQuery,
  historyPage,
  onPageChange,
}) => {
  const { data, isPending, isError, refetch } = historyQuery;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.limit)) : 1;

  const transactions = data?.transactions.filter(
    (tx) => tx.status === "completed" || tx.status === "pending",
  );

  return (
    <section className={styles.historySection} aria-labelledby="billing-history-title">
      <h2 id="billing-history-title" className={styles.sectionHeading}>
        Billing history
      </h2>

      <div className={styles.panel}>
        {isPending && (
          <div className={styles.skeletonList} aria-hidden>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} style={{ height: "2.75rem", width: "100%" }} />
            ))}
          </div>
        )}

        {!isPending && isError && !data && (
          <div className={styles.messageRow}>
            <p>We could not load your billing history.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {transactions && transactions.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden>
              <ReceiptText size={22} />
            </span>
            <p className={styles.emptyTitle}>No payments yet</p>
            <p className={styles.emptyText}>Payments for your plan will show up here.</p>
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Plan</th>
                  <th scope="col" className={styles.numCol}>
                    Amount
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className={styles.dateCell}>{formatDate(tx.transactionDate)}</td>
                    <td className={styles.planCell}>{tx.planName}</td>
                    <td className={`${styles.numCol} ${styles.amountCell}`}>₹{formatInr(tx.amount)}</td>
                    <td>
                      <StatusPill status={tx.status} />
                    </td>
                    <td>
                      <span className={styles.reference} title={tx.transactionId ?? undefined}>
                        {tx.transactionId ?? "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className={styles.mobileList}>
              {transactions.map((tx) => (
                <li key={tx.id} className={styles.mobileItem}>
                  <div className={styles.mobileMain}>
                    <span className={styles.planCell}>{tx.planName}</span>
                    <span className={styles.mobileMeta}>{formatDate(tx.transactionDate)}</span>
                  </div>
                  <div className={styles.mobileSide}>
                    <span className={styles.amountCell}>₹{formatInr(tx.amount)}</span>
                    <StatusPill status={tx.status} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {data && data.totalCount > data.limit && (
        <TeacherListPagination
          page={historyPage}
          totalPages={totalPages}
          onPageChange={(next) => onPageChange(Math.min(Math.max(1, next), totalPages))}
        />
      )}
    </section>
  );
};
