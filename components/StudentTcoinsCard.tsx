import React from "react";
import { Coins } from "lucide-react";
import { useStudentTcoins } from "../helpers/useTcoins";
import type { TcoinHistoryEntry } from "../endpoints/student/tcoins/summary_GET.schema";
import styles from "./StudentTcoinsCard.module.css";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const statusLabel = (entry: TcoinHistoryEntry): { text: string; tone: string } => {
  switch (entry.status) {
    case "pending":
      return { text: "Payment pending", tone: styles.pending };
    case "refunded":
      return { text: "Refunded", tone: styles.neutral };
    default:
      return { text: "Completed", tone: styles.done };
  }
};

/*
 * The wallet's two Tcoins pieces. The summary sits beside the cash balance at
 * the top of the page; the history is the wallet's Tcoins tab. Both render
 * nothing while Tcoins are switched off.
 */
export const StudentTcoinsSummary: React.FC = () => {
  const { data } = useStudentTcoins();

  if (!data?.enabled) return null;

  return (
    <section className={styles.summary} aria-labelledby="tcoins-title">
      <h2 id="tcoins-title" className={styles.title}>
        <Coins size={18} aria-hidden="true" />
        Tcoins
      </h2>
      <p className={styles.balance}>
        {data.balance.toLocaleString("en-IN")} <span>coins</span>
      </p>
      {data.pendingCashback > 0 && (
        <p className={styles.pendingNote}>
          {data.pendingCashback} more arrive when your pending payment goes through.
        </p>
      )}
      <ul className={styles.rules}>
        <li>1 Tcoin = ₹1. Pay up to {data.redeemPercent}% of an order with them (max {data.maxRedeem} coins).</li>
        <li>Earn {data.cashbackPercent}% back on what you pay (max {data.maxCashback} coins per order).</li>
        <li>Tcoins can't be withdrawn or used with a coupon.</li>
      </ul>
    </section>
  );
};

export const StudentTcoinsHistory: React.FC = () => {
  const { data } = useStudentTcoins();

  if (!data?.enabled) return null;

  return (
    <section className={styles.card} aria-label="Tcoins history">
      <div className={styles.results}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Order</th>
              <th>Status</th>
              <th className={styles.numeric}>Used</th>
              <th className={styles.numeric}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {data.history.length > 0 ? (
              data.history.map((entry) => {
                const status = statusLabel(entry);
                // A refunded order hands back what it used and takes back what it earned.
                const counts = entry.status !== "refunded";
                return (
                  <tr key={entry.orderId}>
                    <td className={styles.date}>{dateFormat.format(new Date(entry.createdAt))}</td>
                    <td className={styles.details}>
                      {entry.title}
                      <span className={styles.paid}>Paid {rupees.format(entry.amountPaid)}</span>
                    </td>
                    <td>
                      <span className={`${styles.chip} ${status.tone}`}>{status.text}</span>
                    </td>
                    <td className={`${styles.numeric} ${counts ? styles.out : styles.void}`}>
                      {entry.tcoinsRedeemed > 0 ? `-${entry.tcoinsRedeemed}` : "-"}
                    </td>
                    <td className={`${styles.numeric} ${counts && entry.status === "completed" ? styles.in : styles.void}`}>
                      {entry.tcoinsCashback > 0 ? `+${entry.tcoinsCashback}` : "-"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className={styles.emptyRow}>
                <td colSpan={5}>No Tcoins yet. Every paid order earns some.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
