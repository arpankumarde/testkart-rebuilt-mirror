import React from "react";
import { Wallet, CreditCard } from "lucide-react";
import styles from "./SponsorPaymentMethodSelector.module.css";

export type PaymentMethod = "balance" | "online";

interface SponsorPaymentMethodSelectorProps {
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  isBalanceSufficient: boolean;
  availableBalance: number;
  commissionAmount: number;
  disabled: boolean;
}

export const SponsorPaymentMethodSelector: React.FC<
  SponsorPaymentMethodSelectorProps
> = ({
  paymentMethod,
  setPaymentMethod,
  isBalanceSufficient,
  availableBalance,
  commissionAmount,
  disabled,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={styles.paymentSection}>
      <div className={styles.sectionHeader}>Payment Method</div>

      {/* Balance Option */}
      <label
        className={`${styles.paymentOption} ${
          paymentMethod === "balance" ? styles.selected : ""
        } ${!isBalanceSufficient ? styles.disabledOption : ""}`}
      >
        <div className={styles.radioContainer}>
          <input
            type="radio"
            name="paymentMethod"
            value="balance"
            checked={paymentMethod === "balance"}
            onChange={() => setPaymentMethod("balance")}
            disabled={!isBalanceSufficient || disabled}
            className={styles.radioInput}
          />
        </div>
        <div className={styles.optionContent}>
          <div className={styles.optionHeader}>
            <div className={styles.optionTitle}>
              <Wallet size={18} className={styles.optionIcon} />
              <span>Deduct from Earnings</span>
            </div>
          </div>
          <div className={styles.balanceInfo}>
            Available: {formatCurrency(availableBalance)}
          </div>
          {paymentMethod === "balance" && isBalanceSufficient && (
            <div className={styles.balanceAfter}>
              Balance after:{" "}
              <strong>
                {formatCurrency(availableBalance - commissionAmount)}
              </strong>
            </div>
          )}
          {!isBalanceSufficient && (
            <div className={styles.insufficientText}>Insufficient balance</div>
          )}
        </div>
      </label>

      {/* Online Option */}
      <label
        className={`${styles.paymentOption} ${
          paymentMethod === "online" ? styles.selected : ""
        }`}
      >
        <div className={styles.radioContainer}>
          <input
            type="radio"
            name="paymentMethod"
            value="online"
            checked={paymentMethod === "online"}
            onChange={() => setPaymentMethod("online")}
            disabled={disabled}
            className={styles.radioInput}
          />
        </div>
        <div className={styles.optionContent}>
          <div className={styles.optionHeader}>
            <div className={styles.optionTitle}>
              <CreditCard size={18} className={styles.optionIcon} />
              <span>Pay Online Now</span>
            </div>
            {paymentMethod === "online" && (
              <span className={styles.badge}>Redirects to PayU</span>
            )}
          </div>
          <div className={styles.onlineInfo}>
            Credit/Debit Card, UPI, NetBanking, Wallets
          </div>
        </div>
      </label>
    </div>
  );
};