import React, { useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { couponCategories } from "./StudentCouponCard";
import { useMySpinCoupons } from "../helpers/useSpinWin";
import { computeSpinDiscount, discountLabel, type SpinLineType } from "../helpers/spinWinRules";
import { spinDate } from "../helpers/spinWinFormat";
import { isUsableCoupon } from "../helpers/studentCoupons";
import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import styles from "./SpinWinCouponPicker.module.css";

export type PickerCartItem = { id: number; type: "test" | "course" | "digital_product" | "live_test" | "bundle"; price: number };

type Props = {
  items: PickerCartItem[];
  appliedCode?: string;
  onApply: (code: string) => void;
  isApplying: boolean;
};

const LINE_TYPE: Record<PickerCartItem["type"], SpinLineType> = {
  test: "test",
  course: "course",
  digital_product: "digitalProduct",
  live_test: "live_test",
  bundle: "bundle",
};

type Assessed = { coupon: MySpinCoupon; estimate: number | null; reason: string | null };

/*
 * The student's own coupons, checked against this cart with the same rules the server applies.
 * It is only a guide: Apply still validates on the server, which prices the cart itself.
 */
export const SpinWinCouponPicker: React.FC<Props> = ({ items, appliedCode, onApply, isApplying }) => {
  const [open, setOpen] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const { data, isLoading } = useMySpinCoupons(open);

  const assessed = useMemo<Assessed[]>(() => {
    const lines = items.map((i) => ({ type: LINE_TYPE[i.type], id: i.id, price: i.price }));
    return (data?.coupons ?? []).filter(isUsableCoupon).map((coupon) => {
      const result = computeSpinDiscount(coupon, lines);
      return result.ok ? { coupon, estimate: result.discount, reason: null } : { coupon, estimate: null, reason: result.message };
    });
  }, [data, items]);

  const fitting = assessed.filter((a) => a.estimate !== null);
  const others = assessed.filter((a) => a.estimate === null);

  const apply = (code: string) => {
    onApply(code);
    setOpen(false);
  };

  const renderCoupon = ({ coupon, estimate, reason }: Assessed) => (
    <li key={coupon.id} className={`${styles.item} ${reason ? styles.itemOff : ""}`}>
      <div className={styles.itemMain}>
        <span className={styles.value}>{discountLabel(coupon.discountType, coupon.discountValue).toUpperCase()}</span>
        <code className={styles.code}>{coupon.code}</code>
        <span className={styles.meta}>
          {couponCategories(coupon.eligibleCategories)} · {coupon.minOrderValue > 0 ? `min ₹${coupon.minOrderValue}` : "no minimum"} · expires {spinDate(coupon.expiresAt)}
        </span>
        {reason ? <span className={styles.reason}>{reason}</span> : null}
      </div>
      {reason ? (
        <Badge variant="warning">Ineligible</Badge>
      ) : (
        <div className={styles.itemAction}>
          <span className={styles.saving}>Save ₹{estimate}</span>
          <Button size="sm" onClick={() => apply(coupon.code)} disabled={isApplying || appliedCode === coupon.code}>
            {appliedCode === coupon.code ? "Applied" : "Apply"}
          </Button>
        </div>
      )}
    </li>
  );

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <Ticket size={14} /> View available coupons
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <ConsoleDialogContent size="md">
          <ConsoleDialogHeader title="Your coupons" description="Coupons that fit this cart. One coupon per order." />
          <ConsoleDialogBody className={styles.body}>
            {appliedCode ? (
              <p className={styles.notice}>{appliedCode} is applied. Remove it first to use a different coupon; only one coupon works per order.</p>
            ) : null}
            {isLoading ? (
              <Skeleton style={{ height: "8rem" }} />
            ) : fitting.length === 0 ? (
              <p className={styles.empty}>
                {assessed.length === 0 ? "You have no coupons to use right now." : "None of your coupons fit this cart yet."}
              </p>
            ) : (
              <ul className={styles.list}>{fitting.map(renderCoupon)}</ul>
            )}
            {others.length > 0 ? (
              <>
                <button type="button" className={styles.toggle} onClick={() => setShowOthers((v) => !v)} aria-expanded={showOthers}>
                  {showOthers ? "Hide" : "Show"} {others.length} coupon{others.length === 1 ? "" : "s"} that don't fit this cart
                </button>
                {showOthers ? <ul className={styles.list}>{others.map(renderCoupon)}</ul> : null}
              </>
            ) : null}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </ConsoleDialogFooter>
        </ConsoleDialogContent>
      </Dialog>
    </>
  );
};