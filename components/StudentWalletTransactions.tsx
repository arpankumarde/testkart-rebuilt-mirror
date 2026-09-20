import React from "react";
import { Skeleton } from "./Skeleton";
import { useStudentWalletTransactions } from "../helpers/useStudentWallet";
import { type WalletTransaction } from "../endpoints/student/wallet/transactions_GET.schema";
import styles from "./StudentWalletTransactions.module.css";

const PAGE_SIZE = 50;

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type Direction = "in" | "out" | "none";
type Tone = "credit" | "brand" | "pending" | "neutral" | "failed";

/* A failed or cancelled withdrawal never left the wallet, so it carries no sign. */
const describe = (tx: WalletTransaction): { label: string; tone: Tone; direction: Direction } => {
  switch (tx.withdrawalStatus) {
    case "pending":
      return { label: "Withdrawal processing", tone: "pending", direction: "out" };
    case "completed":
      return { label: "Withdrawn", tone: "neutral", direction: "out" };
    case "failed":
      return { label: "Withdrawal failed", tone: "failed", direction: "none" };
    case "cancelled":
      return { label: "Withdrawal cancelled", tone: "neutral", direction: "none" };
  }
  switch (tx.transactionType) {
    case "prize_credit":
      return { label: "Prize", tone: "credit", direction: "in" };
    case "prize_lock_refund":
      return { label: "Returned", tone: "credit", direction: "in" };
    case "purchase_debit":
      return { label: "Purchase", tone: "brand", direction: "out" };
    case "withdrawal_debit":
      return { label: "Withdrawn", tone: "neutral", direction: "out" };
  }
};

const SIGN: Record<Direction, string> = { in: "+", out: "-", none: "" };

export const StudentWalletTransactions: React.FC = () => {
  const { data, isFetching, error } = useStudentWalletTransactions({ page: 1, limit: PAGE_SIZE });
  const transactions = data?.transactions ?? [];
  const isLoading = isFetching && !data;

  return (
    <section className={styles.card} aria-labelledby="wallet-transactions-title">
      <div className={styles.head}>
        <h2 id="wallet-transactions-title" className={styles.title}>Transactions</h2>
        {data && data.total > transactions.length && (
          <p className={styles.count}>Latest {transactions.length} of {data.total.toLocaleString("en-IN")}</p>
        )}
      </div>

      {error && !data && (
        <p className={styles.error} role="alert">Could not load your transactions. Reload the page to try again.</p>
      )}

      <div className={styles.results}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colDate} />
            <col />
            <col className={styles.colType} />
            <col className={styles.colAmount} />
          </colgroup>
          <thead>
            <tr>
              <th>Date</th>
              <th>Details</th>
              <th>Type</th>
              <th className={styles.numeric}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton style={{ width: "112px", height: "1.25rem" }} /></td>
                  <td><Skeleton style={{ width: "200px", maxWidth: "100%", height: "1.25rem" }} /></td>
                  <td><Skeleton style={{ width: "72px", height: "1.25rem" }} /></td>
                  <td className={styles.numeric}><Skeleton style={{ width: "80px", height: "1.25rem", marginLeft: "auto" }} /></td>
                </tr>
              ))
            ) : transactions.length > 0 ? (
              transactions.map((tx) => {
                const { label, tone, direction } = describe(tx);
                return (
                  <tr key={`${tx.withdrawalStatus ? "w" : "t"}-${tx.id}`}>
                    <td className={styles.date}>{dateTime.format(new Date(tx.createdAt))}</td>
                    <td className={styles.details}>{tx.description || label}</td>
                    <td>
                      <span className={`${styles.chip} ${styles[tone]}`}>{label}</span>
                    </td>
                    <td className={`${styles.numeric} ${styles.amount} ${styles[`amount_${direction}`]}`}>
                      {SIGN[direction]}{rupees.format(tx.amount)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className={styles.emptyRow}>
                <td colSpan={4}>
                  Nothing here yet. Prize money from live tests you win is added to this wallet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};