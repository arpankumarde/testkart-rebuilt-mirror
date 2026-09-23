import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Tag } from "lucide-react";
import { toast } from "sonner";
import { usePublicPromoCodesQuery } from "../helpers/usePublicPromoCodes";
import type { PromoItemType } from "../helpers/promoCodeEligibility";
import type { PublicPromoCode } from "../endpoints/promo-codes/public_GET.schema";
import styles from "./PublicCouponsCard.module.css";

interface PublicCouponsCardProps {
  itemType: PromoItemType;
  itemId: number | null | undefined;
  className?: string;
  spaced?: boolean;
}

const formatRupees = (amount: number) => `₹${new Intl.NumberFormat("en-IN").format(amount)}`;

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));

const getHeadline = (promo: PublicPromoCode) =>
  promo.discountType === "percentage"
    ? `${promo.discountValue}% off`
    : `${formatRupees(promo.discountValue)} off`;

const getFinePrint = (promo: PublicPromoCode) => {
  const parts: string[] = [];
  if (promo.discountType === "percentage" && promo.maxDiscountAmount !== null) {
    parts.push(`Up to ${formatRupees(promo.maxDiscountAmount)} off`);
  }
  if (promo.minPurchaseAmount !== null && promo.minPurchaseAmount > 0) {
    parts.push(`On orders of ${formatRupees(promo.minPurchaseAmount)} or more`);
  }
  if (promo.validUntil) {
    parts.push(`Valid till ${formatDate(promo.validUntil)}`);
  }
  return parts.join(" - ");
};

export const PublicCouponsCard: React.FC<PublicCouponsCardProps> = ({ itemType, itemId, className, spaced = true }) => {
  const { data } = usePublicPromoCodesQuery(itemType, itemId);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const promoCodes = data?.promoCodes ?? [];
  if (promoCodes.length === 0) return null;

  const handleCopy = async (promo: PublicPromoCode) => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopiedId(promo.id);
      toast.success(`Copied ${promo.code}. Apply it before you pay.`);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy the code. Select it and copy manually.");
    }
  };

  return (
    <section className={`${styles.card} ${spaced ? styles.spaced : ""} ${className ?? ""}`} aria-label="Available coupons">
      <div className={styles.header}>
        <Tag size={18} className={styles.headerIcon} aria-hidden="true" />
        <h2 className={styles.title}>Available coupons</h2>
      </div>
      <ul className={styles.list}>
        {promoCodes.map((promo) => {
          const finePrint = getFinePrint(promo);
          const isCopied = copiedId === promo.id;
          return (
            <li key={promo.id} className={styles.item}>
              <span className={styles.code}>{promo.code}</span>
              <div className={styles.details}>
                <div className={styles.headline}>{getHeadline(promo)}</div>
                {finePrint && <div className={styles.finePrint}>{finePrint}</div>}
              </div>
              <button
                type="button"
                className={`${styles.copyButton} ${isCopied ? styles.copied : ""}`}
                onClick={() => handleCopy(promo)}
                aria-label={`Copy code ${promo.code}`}
              >
                {isCopied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {isCopied ? "Copied" : "Copy code"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
