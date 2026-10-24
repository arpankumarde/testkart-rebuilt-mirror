import React from "react";
import { Link } from "react-router-dom";
import { BadgePercent, CalendarCheck, CalendarPlus, Info, Layers, Receipt, ShoppingBag, ShoppingCart, Ticket, Wallet } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { COUPON_BADGE, CouponCode } from "./StudentCouponCard";
import { spinDateTime } from "../helpers/spinWinFormat";
import { shopPathFor } from "../helpers/useSpinWin";
import {
  couponCategories,
  couponCategoryPhrase,
  couponDateFact,
  couponMaxLabel,
  couponMinimumLabel,
  couponRewardSummary,
  couponRupees,
  couponTypeLabel,
  couponValueLabel,
  STUDENT_COUPON_LABELS,
  studentCouponStatus,
} from "../helpers/studentCoupons";
import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import styles from "./StudentCouponDetailsDialog.module.css";

type Props = {
  coupon: MySpinCoupon | null;
  onClose: () => void;
};

type Fact = { icon: React.ReactNode; tone: string; label: string; value: string };

export const StudentCouponDetailsDialog: React.FC<Props> = ({ coupon, onClose }) => (
  <Dialog open={coupon !== null} onOpenChange={(next) => !next && onClose()}>
    <ConsoleDialogContent size="md" className={styles.content}>
      {coupon ? <Details coupon={coupon} onClose={onClose} /> : null}
    </ConsoleDialogContent>
  </Dialog>
);

const Details: React.FC<{ coupon: MySpinCoupon; onClose: () => void }> = ({ coupon, onClose }) => {
  const status = studentCouponStatus(coupon);
  const usable = status === "available" || status === "pending";
  const dateFact = couponDateFact(coupon);
  const savedLine = status === "redeemed" && coupon.savedAmount !== null;

  const facts: Fact[] = [
    { icon: <BadgePercent size={16} />, tone: styles.peach, label: "Discount", value: `${couponValueLabel(coupon)}, ${couponTypeLabel(coupon).toLowerCase()}` },
    { icon: <Layers size={16} />, tone: styles.lavender, label: "Valid on", value: couponCategories(coupon.eligibleCategories) },
    { icon: <ShoppingCart size={16} />, tone: styles.mint, label: "Minimum purchase", value: couponMinimumLabel(coupon) },
    savedLine
      ? { icon: <Wallet size={16} />, tone: styles.butter, label: "You saved", value: couponRupees(coupon.savedAmount ?? 0) }
      : { icon: <Wallet size={16} />, tone: styles.butter, label: "Maximum discount", value: couponMaxLabel(coupon, true) },
    { icon: <CalendarPlus size={16} />, tone: styles.powder, label: "Issued", value: spinDateTime(coupon.issuedAt) },
    {
      icon: <CalendarCheck size={16} />,
      tone: styles.powder,
      label: dateFact.label.replace(" on", ""),
      value: dateFact.date ? spinDateTime(dateFact.date) : "Not recorded",
    },
  ];

  return (
    <>
      <ConsoleDialogHeader title={coupon.code} description={`${coupon.campaignName} · ${couponTypeLabel(coupon)}`} icon={<Ticket size={18} />} className={styles.header}>
        <span className={styles.badgeRow}>
          <Badge variant={COUPON_BADGE[status]} className={styles.badge}>
            {STUDENT_COUPON_LABELS[status]}
          </Badge>
        </span>
      </ConsoleDialogHeader>

      <ConsoleDialogBody className={styles.body}>
        <section className={`${styles.reward} ${usable ? "" : styles.rewardMuted}`} aria-label="Reward">
          <span className={styles.rewardEyebrow}>Your reward</span>
          <span className={styles.rewardValue}>{couponValueLabel(coupon)}</span>
          <p className={styles.rewardText}>{couponRewardSummary(coupon)}</p>
          <CouponCode code={coupon.code} canCopy={usable} size="lg" />
        </section>

        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <span className={`${styles.factIcon} ${fact.tone}`} aria-hidden="true">
                {fact.icon}
              </span>
              <div className={styles.factText}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <section className={styles.rules} aria-labelledby={`coupon-rules-${coupon.id}`}>
          <h3 id={`coupon-rules-${coupon.id}`} className={styles.rulesTitle}>
            <Info size={14} aria-hidden="true" /> How to use this coupon
          </h3>
          <ul>
            <li>Single use: it applies to one order and is used up once that payment succeeds.</li>
            <li>Tied to your account. It cannot be shared or used by anyone else.</li>
            <li>Cannot be combined with any other promo code or offer.</li>
            <li>Only {couponCategoryPhrase(coupon.eligibleCategories)} count towards the minimum purchase and the discount.</li>
            <li>If a payment fails or is cancelled, the coupon is released and you can use it again.</li>
          </ul>
        </section>
      </ConsoleDialogBody>

      <ConsoleDialogFooter className={styles.footer}>
        {usable ? null : (
          <p className={styles.state}>
            {status === "redeemed"
              ? `Redeemed${coupon.redeemedAt ? ` on ${spinDateTime(coupon.redeemedAt)}` : ""}${savedLine ? `. You saved ${couponRupees(coupon.savedAmount ?? 0)}.` : "."}`
              : status === "expired"
                ? `Expired on ${spinDateTime(coupon.expiresAt)}.`
                : "This coupon has been withdrawn."}
          </p>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        {status === "redeemed" && coupon.orderId ? (
          <Button asChild variant="outline">
            <Link to={`/order/${coupon.orderId}`}>
              <Receipt size={16} /> View Order
            </Link>
          </Button>
        ) : null}
        {usable ? (
          <Button asChild>
            <Link to={shopPathFor(coupon.eligibleCategories)}>
              <ShoppingBag size={16} /> Shop Now
            </Link>
          </Button>
        ) : null}
      </ConsoleDialogFooter>
    </>
  );
};
