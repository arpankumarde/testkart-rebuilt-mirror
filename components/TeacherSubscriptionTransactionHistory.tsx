import React from "react";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { TeacherListPagination } from "./TeacherListPagination";
import { FileText } from "lucide-react";
import styles from "./TeacherSubscriptionTransactionHistory.module.css";
import { useSubscriptionHistoryQuery } from "../helpers/useTeacherSubscription";

const HistorySkeletonRows: React.FC<{ count: number }> = ({ count }) => (
  <>
    {[...Array(count)].map((_, i) => (
      <tr key={i}>
        <td>
          <Skeleton style={{ height: "20px" }} />
        </td>
        <td>
          <Skeleton style={{ height: "20px" }} />
        </td>
        <td>
          <Skeleton style={{ height: "20px" }} />
        </td>
        <td>
          <Skeleton style={{ height: "20px" }} />
        </td>
        <td>
          <Skeleton style={{ height: "20px" }} />
        </td>
      </tr>
    ))}
  </>
);

export interface TransactionHistoryProps {
  historyQuery: ReturnType<typeof useSubscriptionHistoryQuery>;
  historyPage: number;
  onPageChange: (page: number) => void;
}

export const TeacherSubscriptionTransactionHistory: React.FC<TransactionHistoryProps> = ({
  historyQuery,
  historyPage,
  onPageChange,
}) => {
  const { data, isFetching, isError } = historyQuery;
  const totalPages = data ? Math.ceil(data.totalCount / data.limit) : 1;

  // Filter for completed or pending locally as requested
  const filteredTransactions = data?.transactions.filter(
    (tx) => tx.status === "completed" || tx.status === "pending"
  );

  return (
    <section className={styles.historySection}>
      <h2 className={styles.sectionHeading}>Transaction History</h2>
      <div className={styles.tableContainer}>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Transaction ID</th>
            </tr>
          </thead>
          <tbody>
            {isFetching && <HistorySkeletonRows count={5} />}
            {!isFetching &&
              filteredTransactions?.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    {new Date(tx.transactionDate!).toLocaleDateString("en-IN")}
                  </td>
                  <td>{tx.planName}</td>
                  <td className={styles.amount}>₹{tx.amount.toLocaleString("en-IN")}</td>
                  <td>
                    <Badge
                      variant={
                        tx.status === "completed" ? "success" : "warning"
                      }
                    >
                      {tx.status}
                    </Badge>
                  </td>
                  <td className={styles.txnId}>{tx.transactionId}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!isFetching && isError && (
          <p className={styles.errorText}>Could not load history.</p>
        )}
        {!isFetching && filteredTransactions?.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <FileText size={26} />
            </span>
            <h3>No transactions yet</h3>
            <p>Payments for your plan will be listed here.</p>
          </div>
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