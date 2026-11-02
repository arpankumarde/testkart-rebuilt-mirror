import React from "react";
import { Coins, Info } from "lucide-react";
import { Checkbox } from "./Checkbox";
import {
  ONE_OFFER_MESSAGE,
  tcoinsCashbackFor,
  tcoinsRedeemableFor,
  tcoinsRupeeValue,
} from "../helpers/tcoinsMath";
import type { OutputType as TcoinsSummary } from "../endpoints/student/tcoins/summary_GET.schema";
import styles from "./TcoinsCheckoutOption.module.css";

interface TcoinsCheckoutOptionProps {
  summary: TcoinsSummary;
  /** The order value before coupons. Coins can cover redeemPercent of it, up to maxRedeem coins. */
  orderValue: number;
  /** What the student pays in cash with the current choice. Cashback is earned on this. */
  amountToPay: number;
  checked: boolean;
  /**
   * Ticking it while a promo code is applied is allowed: the parent removes the
   * code, since a promo code and Tcoins never combine.
   */
  onCheckedChange: (checked: boolean) => void;
  /** The promo code currently applied, if any; ticking Tcoins replaces it. */
  appliedCouponCode?: string | null;
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
  appliedCouponCode,
  className,
}) => {
  if (!summary.enabled) return null;

  const redeemable = tcoinsRedeemableFor(summary, orderValue, summary.balance);
  const canUse = redeemable > 0;
  const couponApplied = !!appliedCouponCode;
  const cashback = tcoinsCashbackFor(summary, amountToPay);

  const hint = summary.balance <= 0
    ? "You don't have any Tcoins yet. Earn them as cashback on paid orders."
    : !canUse
      ? "This order is too small to use your Tcoins."
      : couponApplied
        ? `Ticking this removes the promo code ${appliedCouponCode}.`
        : `Pay up to ${summary.redeemPercent}% of an order (at most ${summary.maxRedeem} Tcoins) with Tcoins.`;

  return (
    <div className={`${styles.box} ${className ?? ""}`}>
      <div className={styles.head}>
        <span className={styles.headTitle}>
          <Coins size={18} aria-hidden="true" />
          Tcoins
        </span>
        {summary.balance > 0 ? (
          <span className={styles.balance}>{summary.balance.toLocaleString("en-IN")} available</span>
        ) : null}
      </div>

      {canUse ? (
        <label className={styles.useRow}>
          <Checkbox
            checked={checked && !couponApplied}
            onChange={(e) => onCheckedChange(e.target.checked)}
          />
          <span className={styles.useText}>
            <span className={styles.useTitle}>
              Use {redeemable} Tcoins and save ₹{tcoinsRupeeValue(redeemable)}
            </span>
            <span className={styles.useHint}>{hint}</span>
          </span>
        </label>
      ) : (
        <p className={styles.useHint}>{hint}</p>
      )}

      {canUse && (
        <p className={styles.oneOffer}>
          <Info size={14} aria-hidden="true" />
          {ONE_OFFER_MESSAGE}
        </p>
      )}
      {cashback > 0 && (
        <p className={styles.earn}>
          Earn <strong>{cashback} Tcoins</strong> cashback on this order.
        </p>
      )}
    </div>
  );
};
