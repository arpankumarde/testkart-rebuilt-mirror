import React from "react";
import styles from "./SponsorCostBreakdown.module.css";

interface SponsorCostBreakdownProps {
  testPrice: number;
  discountPrice?: number | null;
}

/** Item price plus the platform fee row, which is always waived for sponsored enrollments. */
export const SponsorCostBreakdown: React.FC<SponsorCostBreakdownProps> = ({
  testPrice,
  discountPrice,
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
        <span>Platform fee</span>
        <span className={styles.freeAmount}>Waived - you pay {formatCurrency(0)}</span>
      </div>
    </div>
  );
};
