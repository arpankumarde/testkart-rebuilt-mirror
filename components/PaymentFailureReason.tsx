import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import type { PaymentFailureDetails } from "../helpers/paymentFailureReason";
import styles from "./PaymentFailureReason.module.css";

const DETAIL_ROWS: Array<{ key: "errorMessage" | "bankMessage" | "errorCode" | "gatewayStatus"; label: string }> = [
  { key: "errorMessage", label: "PayU message" },
  { key: "bankMessage", label: "Bank message" },
  { key: "errorCode", label: "Error code" },
  { key: "gatewayStatus", label: "PayU status" },
];

interface PaymentFailureReasonProps {
  failure: PaymentFailureDetails;
  // "compact" sits under a status badge in a table row; "card" fills a card stat.
  variant?: "compact" | "card";
}

/* Short reason for a failed payment; PayU's own wording opens in a popover. */
export const PaymentFailureReason: React.FC<PaymentFailureReasonProps> = ({ failure, variant = "compact" }) => {
  const captured = failure.reason === "payment_captured";
  const className = [styles.reason, variant === "card" ? styles.card : "", captured ? styles.alert : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={className}>
          {failure.label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.popover}>
        {captured && (
          <p className={styles.note}>
            PayU reports this payment as captured, but it is not marked completed here. Check it before reconciling or
            refunding.
          </p>
        )}
        <dl className={styles.details}>
          <div>
            <dt>Reason</dt>
            <dd>{failure.label}</dd>
          </div>
          {DETAIL_ROWS.filter((row) => failure[row.key]).map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{failure[row.key]}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
};