import React from "react";
import styles from "./SponsorCostBreakdown.module.css";

interface SponsorCostBreakdownProps {
  testPrice: number;
  commissionAmount: number;
  discountPrice?: number | null;
  isFreeEnrollment?: boolean;
}

export const SponsorCostBreakdown: React.FC<SponsorCostBreakdownProps> = ({
  testPrice,
  commissionAmount,
  discountPrice,
  isFreeEnrollment,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasDiscount =
    discountPrice !== null &&
    discountPrice !== undefined &&
    discountPrice < testPrice;

  return (
    <div className={styles.costBreakdown}>
      <div className={styles.costRow}>
        <span>Item Price</span>
        {hasDiscount ? (
          <span className={styles.priceWithDiscount}>
            <span className={styles.originalPrice}>
              {formatCurrency(testPrice)}
            </span>
            <span>{formatCurrency(discountPrice!)}</span>
          </span>
        ) : (
          <span>{formatCurrency(testPrice)}</span>
        )}
      </div>
      <div className={`${styles.costRow} ${styles.totalRow}`}>
        <span>Enrollment Fee</span>
        {isFreeEnrollment ? (
          <span className={styles.freeAmount}>FREE</span>
        ) : (
          <span className={styles.highlightAmount}>
            {formatCurrency(commissionAmount)}
          </span>
        )}
      </div>
    </div>
  );
};