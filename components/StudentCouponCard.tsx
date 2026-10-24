import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BadgePercent, CalendarCheck, Check, Copy, Eye, Gift, Layers, Receipt, ShoppingBag, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { spinDate } from "../helpers/spinWinFormat";
import { shopPathFor } from "../helpers/useSpinWin";
import {
  couponCategories,
  couponDateFact,
  couponMaxLabel,
  couponMinimumLabel,
  couponRupees,
  couponValueLabel,
  STUDENT_COUPON_LABELS,
  studentCouponStatus,
  type StudentCouponStatus,
} from "../helpers/studentCoupons";
import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import styles from "./StudentCouponCard.module.css";

type Variant = React.ComponentProps<typeof Badge>["variant"];

export const COUPON_BADGE: Record<StudentCouponStatus | "ineligible", Variant> = {
  available: "success",
  pending: "lavender",
  redeemed: "lavender",
  expired: "outline",
  withdrawn: "destructive",
  ineligible: "warning",
};

/** The code with a Copy button that confirms for two seconds. Shared by the card and the details modal. */
export const CouponCode: React.FC<{ code: string; canCopy: boolean; size?: "md" | "lg" }> = ({ code, canCopy, size = "md" }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${code} copied`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed. Select the code and copy it instead.");
    }
  };
  return (
    <div className={`${styles.codeBox} ${size === "lg" ? styles.codeBoxLg : ""} ${canCopy ? "" : styles.codeBoxMuted}`}>
      <div className={styles.codeText}>
        <span className={styles.codeLabel}>Coupon code</span>
        <code className={styles.code}>{code}</code>
      </div>
      {canCopy ? (
        <Button variant="outline" size="sm" onClick={copy} aria-label={copied ? `${code} copied` : `Copy ${code}`} className={styles.copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </Button>
      ) : null}
    </div>
  );
};

type Props = {
  coupon: MySpinCoupon;
  onDetails: () => void;
};

export const StudentCouponCard: React.FC<Props> = ({ coupon, onDetails }) => {
  const status = studentCouponStatus(coupon);
  const usable = status === "available" || status === "pending";
  const dateFact = couponDateFact(coupon);

  return (
    <article className={`${styles.card} ${styles[status]}`}>
      <div className={styles.top}>
        <span className={styles.icon} aria-hidden="true">
          <Gift size={18} />
        </span>
        <div className={styles.headline}>
          <span className={styles.value}>{couponValueLabel(coupon)}</span>
          <span className={styles.campaign}>{coupon.campaignName}</span>
        </div>
        <Badge variant={COUPON_BADGE[status]} className={styles.badge}>
          {STUDENT_COUPON_LABELS[status]}
        </Badge>
      </div>

      <div className={styles.perforation} aria-hidden="true" />

      <CouponCode code={coupon.code} canCopy={usable} />

      <dl className={styles.facts}>
        <div>
          <dt>
            <Layers size={13} aria-hidden="true" /> Valid on
          </dt>
          <dd>{couponCategories(coupon.eligibleCategories)}</dd>
        </div>
        <div>
          <dt>
            <ShoppingCart size={13} aria-hidden="true" /> Minimum purchase
          </dt>
          <dd>{couponMinimumLabel(coupon)}</dd>
        </div>
        <div>
          <dt>
            <BadgePercent size={13} aria-hidden="true" /> {status === "redeemed" && coupon.savedAmount !== null ? "You saved" : "Maximum discount"}
          </dt>
          <dd>{status === "redeemed" && coupon.savedAmount !== null ? couponRupees(coupon.savedAmount) : couponMaxLabel(coupon)}</dd>
        </div>
        <div>
          <dt>
            <CalendarCheck size={13} aria-hidden="true" /> {dateFact.label}
          </dt>
          <dd>{dateFact.date ? spinDate(dateFact.date) : "Not recorded"}</dd>
        </div>
      </dl>

      {status === "pending" ? <p className={styles.hint}>A payment with this coupon is in progress. If it failed, you can use the coupon again.</p> : null}

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
        <Button size="sm" variant="ghost" onClick={onDetails} className={styles.details}>
          <Eye size={14} /> View Details
        </Button>
      </div>
    </article>
  );
};
