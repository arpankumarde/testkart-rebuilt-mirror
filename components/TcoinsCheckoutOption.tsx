import React from "react";
import { Coins } from "lucide-react";
import { Checkbox } from "./Checkbox";
import { tcoinsCashbackFor, tcoinsRedeemableFor } from "../helpers/tcoinsMath";
import type { OutputType as TcoinsSummary } from "../endpoints/student/tcoins/summary_GET.schema";
import styles from "./TcoinsCheckoutOption.module.css";

interface TcoinsCheckoutOptionProps {
  summary: TcoinsSummary;
  /** The order value before coupons. Coins can cover redeemPercent of it. */
  orderValue: number;
  /** What the student pays in cash with the current choice. Cashback is earned on this. */
  amountToPay: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  couponApplied: boolean;
  className?: string;
}

/** How many coins an order would spend, matching what the server charges. */
export const tcoinsToSpend = (
  summary: TcoinsSummary | undefined,
  orderValue: number,
  wantsTcoins: boolean,
  couponApplied: boolean
): number =>
  summary?.enabled && wantsTcoins && !couponApplied
    ? tcoinsRedeemableFor(summary, orderValue, summary.balance)
    : 0;

export const TcoinsCheckoutOption: React.FC<TcoinsCheckoutOptionProps> = ({
  summary,
  orderValue,
  amountToPay,
  checked,
  onCheckedChange,
  couponApplied,
  className,
}) => {
  if (!summary.enabled) return null;

  const redeemable = tcoinsRedeemableFor(summary, orderValue, summary.balance);
  const canUse = redeemable > 0 && !couponApplied;
  const cashback = tcoinsCashbackFor(summary, amountToPay);

  const hint = couponApplied && redeemable > 0
    ? "Tcoins can't be combined with a coupon. Remove the coupon to use them."
    : summary.balance <= 0
      ? "You have no Tcoins yet. Earn them as cashback on paid orders."
      : canUse
        ? `Balance ${summary.balance} Tcoins. Pay up to ${summary.redeemPercent}% of an order with Tcoins.`
        : `Balance ${summary.balance} Tcoins. This order is too small to use them.`;

  return (
    <div className={`${styles.box} ${className ?? ""}`}>
      <label className={`${styles.useRow} ${canUse ? "" : styles.useRowDisabled}`}>
        <Checkbox
          checked={checked && canUse}
          disabled={!canUse}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span className={styles.useText}>
          <span className={styles.useTitle}>
            <Coins size={16} aria-hidden="true" />
            {canUse ? `Use ${redeemable} Tcoins and save ₹${redeemable}` : "Tcoins"}
          </span>
          <span className={styles.useHint}>{hint}</span>
        </span>
      </label>
      {cashback > 0 && (
        <p className={styles.earn}>
          You earn <strong>{cashback} Tcoins</strong> cashback on this order
        </p>
      )}
    </div>
  );
};