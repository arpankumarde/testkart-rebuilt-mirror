import React from "react";
import { 
  useStudentWalletBalance, 
  useStudentWalletTransactions 
} from "../helpers/useStudentWallet";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { Wallet, ArrowDownRight, ArrowUpRight, Trophy, ShoppingBag, Banknote, Clock, XCircle } from "lucide-react";
import { WalletTransaction } from "../endpoints/student/wallet/transactions_GET.schema";
import styles from "./StudentWalletOverview.module.css";

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateInput));
};

type TransactionBadgeProps = {
  tx: WalletTransaction;
};

const TransactionBadge: React.FC<TransactionBadgeProps> = ({ tx }) => {
  if (tx.withdrawalStatus) {
    switch (tx.withdrawalStatus) {
      case "pending":
        return (
          <Badge variant="warning">
            <span className={styles.badgeContent}>
              <Clock size={14} /> Withdrawal Pending
            </span>
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default">
            <span className={styles.badgeContent}>
              <Banknote size={14} /> Withdrawal Completed
            </span>
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <span className={styles.badgeContent}>
              <XCircle size={14} /> Withdrawal Failed
            </span>
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline">
            <span className={styles.badgeContent}>
              <XCircle size={14} /> Withdrawal Cancelled
            </span>
          </Badge>
        );
    }
  }

  if (tx.transactionType === "prize_credit" || tx.transactionType === "prize_lock_refund") {
    return (
      <Badge variant="success">
        <span className={styles.badgeContent}>
          <ArrowDownRight size={14} /> Credit
        </span>
      </Badge>
    );
  }

  if (tx.transactionType === "purchase_debit") {
    return (
      <Badge variant="secondary">
        <span className={styles.badgeContent}>
          <ShoppingBag size={14} /> Purchase
        </span>
      </Badge>
    );
  }

  return (
    <Badge variant="default">
      <span className={styles.badgeContent}>
        <ArrowUpRight size={14} /> Debit
      </span>
    </Badge>
  );
};

const isDebitTransaction = (tx: WalletTransaction): boolean => {
  if (tx.withdrawalStatus) return true;
  return (
    tx.transactionType === "purchase_debit" ||
    tx.transactionType === "withdrawal_debit"
  );
};

export const StudentWalletOverview: React.FC = () => {
  const { data: balanceData, isFetching: isLoadingBalance } = useStudentWalletBalance();
  const { data: txData, isFetching: isLoadingTx } = useStudentWalletTransactions({ page: 1, limit: 50 });

  return (
    <div className={styles.container}>
      {/* Balance Card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceHeader}>
          <div className={styles.balanceIcon}>
            <Wallet size={24} />
          </div>
          <span className={styles.balanceTitle}>Available balance</span>
        </div>
        <div className={styles.balanceAmount}>
          {isLoadingBalance ? (
            <Skeleton style={{ width: "200px", height: "3rem" }} />
          ) : (
            <span>{formatINR(balanceData?.availableBalance || 0)}</span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIconContainer}>
            <Trophy size={20} className={styles.statIconCredit} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Prize money won</span>
            {isLoadingBalance ? (
              <Skeleton style={{ width: "100px", height: "1.5rem" }} />
            ) : (
              <span className={styles.statValue}>{formatINR(balanceData?.totalCredits || 0)}</span>
            )}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconContainer}>
            <ArrowUpRight size={20} className={styles.statIconDebit} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Withdrawn</span>
            {isLoadingBalance ? (
              <Skeleton style={{ width: "100px", height: "1.5rem" }} />
            ) : (
              <span className={styles.statValue}>{formatINR(balanceData?.totalWithdrawn || 0)}</span>
            )}
          </div>
        </div>

        {(balanceData?.totalPurchased || 0) > 0 && (
          <div className={styles.statCard}>
            <div className={styles.statIconContainer}>
              <ShoppingBag size={20} className={styles.statIconPurchase} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Used for purchases</span>
              {isLoadingBalance ? (
                <Skeleton style={{ width: "100px", height: "1.5rem" }} />
              ) : (
                <span className={styles.statValue}>{formatINR(balanceData?.totalPurchased || 0)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className={styles.transactionsSection}>
        <h3 className={styles.sectionTitle}>Transaction history</h3>

        {isLoadingTx ? (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th className={styles.amountHeader}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton style={{ width: "120px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "180px", height: "1.25rem" }} /></td>
                      <td><Skeleton style={{ width: "80px", height: "1.25rem" }} /></td>
                      <td className={styles.amountCell}><Skeleton style={{ width: "80px", height: "1.25rem", marginLeft: "auto" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileTxList}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.mobileTxCard}>
                  <Skeleton style={{ width: "100%", height: "3.5rem" }} />
                </div>
              ))}
            </div>
          </>
        ) : txData?.transactions && txData.transactions.length > 0 ? (
          <>
            {/* Desktop/tablet table */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th className={styles.amountHeader}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {txData.transactions.map((tx) => {
                    const isDebit = isDebitTransaction(tx);
                    return (
                      <tr key={`${tx.withdrawalStatus ? "w" : "t"}-${tx.id}`}>
                        <td className={styles.dateCell}>{formatDate(tx.createdAt)}</td>
                        <td className={styles.descCell}>{tx.description || "Wallet Transaction"}</td>
                        <td>
                          <TransactionBadge tx={tx} />
                        </td>
                        <td className={`${styles.amountCell} ${isDebit ? styles.amountDebit : styles.amountCredit}`}>
                          {isDebit ? "-" : "+"}{formatINR(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards, shown instead of the table below the sm breakpoint */}
            <div className={styles.mobileTxList}>
              {txData.transactions.map((tx) => {
                const isDebit = isDebitTransaction(tx);
                return (
                  <div key={`m-${tx.withdrawalStatus ? "w" : "t"}-${tx.id}`} className={styles.mobileTxCard}>
                    <div className={styles.mobileTxTopRow}>
                      <span className={styles.mobileTxDate}>{formatDate(tx.createdAt)}</span>
                      <span className={`${styles.amountCell} ${isDebit ? styles.amountDebit : styles.amountCredit}`}>
                        {isDebit ? "-" : "+"}{formatINR(tx.amount)}
                      </span>
                    </div>
                    <p className={styles.mobileTxDesc}>{tx.description || "Wallet Transaction"}</p>
                    <TransactionBadge tx={tx} />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <Trophy size={32} className={styles.emptyIcon} />
            <p>No transactions yet.</p>
            <p className={styles.emptySubtext}>Win live tests to earn prizes!</p>
          </div>
        )}
      </div>
    </div>
  );
};