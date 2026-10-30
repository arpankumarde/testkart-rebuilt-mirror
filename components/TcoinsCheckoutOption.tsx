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
    ? "You have no Tcoins yet. Earn them as cashback on paid orders."
    : !canUse
      ? `Balance ${summary.balance} Tcoins. This order is too small to use them.`
      : couponApplied
        ? `Balance ${summary.balance} Tcoins. Ticking this removes the promo code ${appliedCouponCode}.`
        : `Balance ${summary.balance} Tcoins. Pay up to ${summary.redeemPercent}% of an order (at most ${summary.maxRedeem} Tcoins) with Tcoins.`;

  return (
    <div className={`${styles.box} ${className ?? ""}`}>
      <label className={`${styles.useRow} ${canUse ? "" : styles.useRowDisabled}`}>
        <Checkbox
          checked={checked && canUse && !couponApplied}
          disabled={!canUse}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span className={styles.useText}>
          <span className={styles.useTitle}>
            <Coins size={16} aria-hidden="true" />
            {canUse ? `Use ${redeemable} Tcoins and save ₹${tcoinsRupeeValue(redeemable)}` : "Tcoins"}
          </span>
          <span className={styles.useHint}>{hint}</span>
        </span>
      </label>
      {canUse && (
        <p className={styles.oneOffer}>
          <Info size={14} aria-hidden="true" />
          {ONE_OFFER_MESSAGE}
        </p>
      )}
      {cashback > 0 && (
        <p className={styles.earn}>
          You earn <strong>{cashback} Tcoins</strong> cashback on this order
        </p>
      )}
    </div>
  );
};
