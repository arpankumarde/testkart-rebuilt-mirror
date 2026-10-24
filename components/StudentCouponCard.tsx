import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Eye, Receipt, ShoppingBag, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { discountLabel, SPIN_CATEGORY_LABELS, type SpinCategory } from "../helpers/spinWinRules";
import { spinDate } from "../helpers/spinWinFormat";
import { shopPathFor } from "../helpers/useSpinWin";
import { STUDENT_COUPON_LABELS, studentCouponStatus, type StudentCouponStatus } from "../helpers/studentCoupons";
import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import styles from "./StudentCouponCard.module.css";

type Variant = React.ComponentProps<typeof Badge>["variant"];

export const COUPON_BADGE: Record<StudentCouponStatus | "ineligible", Variant> = {
  available: "success",
  pending: "lavender",
  redeemed: "default",
  expired: "secondary",
  withdrawn: "destructive",
  ineligible: "warning",
};

export const couponCategories = (categories: string[]) => categories.map((c) => SPIN_CATEGORY_LABELS[c as SpinCategory] ?? c).join(", ");

type Props = {
  coupon: MySpinCoupon;
  onDetails: () => void;
};

export const StudentCouponCard: React.FC<Props> = ({ coupon, onDetails }) => {
  const [copied, setCopied] = useState(false);
  const status = studentCouponStatus(coupon);
  const usable = status === "available" || status === "pending";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed. Select the code and copy it instead.");
    }
  };

  return (
    <article className={`${styles.card} ${usable ? "" : styles.muted}`}>
      <div className={styles.top}>
        <span className={styles.icon} aria-hidden="true">
          <Ticket size={18} />
        </span>
        <div className={styles.headline}>
          <span className={styles.value}>{discountLabel(coupon.discountType, coupon.discountValue).toUpperCase()}</span>
          <span className={styles.campaign}>{coupon.campaignName}</span>
        </div>
        <Badge variant={COUPON_BADGE[status]}>{STUDENT_COUPON_LABELS[status]}</Badge>
      </div>

      <div className={styles.codeRow}>
        <code className={styles.code}>{coupon.code}</code>
        {usable ? (
          <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${coupon.code}`}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy Code"}
          </Button>
        ) : null}
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Valid on</dt>
          <dd>{couponCategories(coupon.eligibleCategories)}</dd>
        </div>
        <div>
          <dt>Minimum purchase</dt>
          <dd>{coupon.minOrderValue > 0 ? `₹${coupon.minOrderValue}` : "No minimum order requirement"}</dd>
        </div>
        <div>
          <dt>{status === "redeemed" ? "You saved" : "Maximum discount"}</dt>
          <dd>
            {status === "redeemed" && coupon.savedAmount !== null
              ? `₹${coupon.savedAmount}`
              : `${coupon.maxDiscountAmount ? `₹${coupon.maxDiscountAmount} or ` : ""}${coupon.maxDiscountPercent}% of eligible items`}
          </dd>
        </div>
        <div>
          <dt>{status === "expired" ? "Expired on" : "Expires on"}</dt>
          <dd>{spinDate(coupon.expiresAt)}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        {usable ? (
          <Button asChild size="sm">
            <Link to={shopPathFor(coupon.eligibleCategories)}>
              <ShoppingBag size={14} /> Shop Now
            </Link>
          </Button>
        ) : null}
        {status === "redeemed" && coupon.orderId ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/order/${coupon.orderId}`}>
              <Receipt size={14} /> View Order
            </Link>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDetails}>
          <Eye size={14} /> View Details
        </Button>
      </div>
      {status === "pending" ? <p className={styles.hint}>A payment with this coupon is in progress. If it failed, you can use the coupon again.</p> : null}
    </article>
  );
};