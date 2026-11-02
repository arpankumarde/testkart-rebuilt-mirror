import React, { useState } from "react";
import { GraduationCap, Ticket } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { couponCategories, couponRupees } from "../helpers/studentCoupons";
import { spinDate } from "../helpers/spinWinFormat";
import { describeOfferItems, formatOfferInr } from "../helpers/courseCouponOffer";
import type { OutputType as CartQuote, QuoteCoupon, QuoteTeacherOffer } from "../endpoints/cart/quote_POST.schema";
import styles from "./CartCouponPicker.module.css";

type Props = {
  quote: CartQuote | undefined;
  isLoading: boolean;
  /** Tcoins replace every coupon, teacher offers included, while they are on. */
  tcoinsActive: boolean;
  onApply: (coupon: { promoCodeId: number; code: string }) => void;
  onRemove: () => void;
  applyingId: number | null;
};

const valueLabel = (type: "percentage" | "fixed", value: number) =>
  type === "percentage" ? `${value}% OFF` : `${couponRupees(value)} OFF`;

const APPLIES_TO_LABELS: Record<string, string> = {
  all: "All items",
  tests: "Test series",
  courses: "Courses",
  digital_products: "Study notes",
};

/*
 * The cart's coupons in one place. Teacher offers are applied by the server on
 * their own and only shown here; the student picks at most one Testkart coupon
 * (Spin & Win or a public admin code), priced on the cart after those offers.
 * Every figure comes from cart/quote, so it matches what checkout charges.
 */
export const CartCouponPicker: React.FC<Props> = ({ quote, isLoading, tcoinsActive, onApply, onRemove, applyingId }) => {
  const [open, setOpen] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

  const offers = quote?.autoOffers ?? [];
  const coupons = quote?.coupons ?? [];
  const chosen = tcoinsActive ? null : quote?.chosen ?? null;
  const fitting = coupons.filter((c) => c.estimate !== null || c.promoCodeId === chosen?.promoCodeId);
  const others = coupons.filter((c) => c.estimate === null && c.promoCodeId !== chosen?.promoCodeId);
  const chosenOutsideList = chosen && !coupons.some((c) => c.promoCodeId === chosen.promoCodeId) ? chosen : null;

  const renderOffer = (offer: QuoteTeacherOffer) => (
    <li key={offer.promoCodeId} className={`${styles.item} ${styles.itemTeacher}`}>
      <div className={styles.itemMain}>
        <span className={styles.value}>{valueLabel(offer.discountType, offer.discountValue)}</span>
        <code className={styles.code}>{offer.code}</code>
        <span className={styles.meta}>
          Teacher offer on {describeOfferItems(offer.eligibleCourseIds.length, offer.eligibleDigitalProductIds.length)}
          {offer.teacherName ? ` by ${offer.teacherName}` : ""}
        </span>
      </div>
      <div className={styles.itemAction}>
        {tcoinsActive ? (
          <Badge variant="secondary">Off with Tcoins</Badge>
        ) : (
          <>
            <span className={styles.saving}>Save {formatOfferInr(offer.discountAmount)}</span>
            <Badge variant="success">Applied</Badge>
          </>
        )}
      </div>
    </li>
  );

  const couponMeta = (c: QuoteCoupon) => {
    const scope = c.categories ? couponCategories(c.categories) : APPLIES_TO_LABELS[c.appliesTo] ?? "All items";
    const minimum = c.minOrderValue && c.minOrderValue > 0 ? `min ${couponRupees(c.minOrderValue)}` : "no minimum";
    const expiry = c.expiresAt ? ` · expires ${spinDate(c.expiresAt)}` : "";
    return `${scope} · ${minimum}${expiry}`;
  };

  const renderCoupon = (c: QuoteCoupon) => {
    const isApplied = chosen?.promoCodeId === c.promoCodeId;
    const saving = isApplied ? chosen!.discountAmount : c.estimate;
    return (
      <li key={c.promoCodeId} className={`${styles.item} ${c.reason && !isApplied ? styles.itemOff : ""} ${isApplied ? styles.itemApplied : ""}`}>
        <div className={styles.itemMain}>
          <span className={styles.value}>{valueLabel(c.discountType, c.discountValue)}</span>
          <code className={styles.code}>{c.code}</code>
          <span className={styles.meta}>{couponMeta(c)}</span>
          {c.reason && !isApplied ? <span className={styles.reason}>{c.reason}</span> : null}
        </div>
        <div className={styles.itemAction}>
          {isApplied ? (
            <>
              {saving !== null ? <span className={styles.saving}>Save {formatOfferInr(saving)}</span> : null}
              <Badge variant="success">Applied</Badge>
              <button type="button" className={styles.remove} onClick={onRemove}>
                Remove
              </button>
            </>
          ) : c.reason ? (
            <Badge variant="warning">Not eligible</Badge>
          ) : (
            <>
              <span className={styles.saving}>Save {formatOfferInr(c.estimate ?? 0)}</span>
              <Button
                size="sm"
                className={styles.applyButton}
                onClick={() => onApply({ promoCodeId: c.promoCodeId, code: c.code })}
                disabled={applyingId !== null}
              >
                {applyingId === c.promoCodeId ? "Applying..." : chosen ? "Switch" : "Apply"}
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <Ticket size={14} /> View available coupons
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <ConsoleDialogContent size="md">
          <ConsoleDialogHeader
            title="Available coupons"
            description="Teacher offers apply on their own. You can add one Testkart coupon on top."
          />
          <ConsoleDialogBody className={styles.body}>
            {tcoinsActive ? (
              <p className={styles.notice}>
                Tcoins are on, and they replace every coupon on this order, teacher offers included. Applying a coupon turns Tcoins off.
              </p>
            ) : null}

            {isLoading && !quote ? (
              <Skeleton style={{ height: "8rem" }} />
            ) : (
              <>
                {offers.length > 0 ? (
                  <section className={styles.section} aria-labelledby="cart-coupons-teacher">
                    <div className={styles.sectionHead}>
                      <h3 id="cart-coupons-teacher" className={styles.sectionTitle}>
                        <GraduationCap size={16} aria-hidden="true" /> Teacher offers
                      </h3>
                      <p className={styles.sectionNote}>Applied automatically to the teacher's courses and study notes. No code needed.</p>
                    </div>
                    <ul className={styles.list}>{offers.map(renderOffer)}</ul>
                  </section>
                ) : null}

                <section className={styles.section} aria-labelledby="cart-coupons-testkart">
                  <div className={styles.sectionHead}>
                    <h3 id="cart-coupons-testkart" className={styles.sectionTitle}>
                      <Ticket size={16} aria-hidden="true" /> Testkart coupons
                    </h3>
                    <p className={styles.sectionNote}>
                      Pick one.{offers.length > 0 ? " It is added on top of the teacher offer." : ""} Picking another one replaces it.
                    </p>
                  </div>

                  {chosenOutsideList ? (
                    <ul className={styles.list}>
                      <li className={`${styles.item} ${styles.itemApplied}`}>
                        <div className={styles.itemMain}>
                          <code className={styles.code}>{chosenOutsideList.code}</code>
                          <span className={styles.meta}>
                            The code you entered.
                            {chosenOutsideList.replacesAutoOnItems.length > 0 ? " It replaces the teacher offer on the items it covers." : ""}
                          </span>
                        </div>
                        <div className={styles.itemAction}>
                          <span className={styles.saving}>Save {formatOfferInr(chosenOutsideList.discountAmount)}</span>
                          <Badge variant="success">Applied</Badge>
                          <button type="button" className={styles.remove} onClick={onRemove}>
                            Remove
                          </button>
                        </div>
                      </li>
                    </ul>
                  ) : null}

                  {fitting.length > 0 ? (
                    <ul className={styles.list}>{fitting.map(renderCoupon)}</ul>
                  ) : chosenOutsideList ? null : (
                    <p className={styles.empty}>
                      {coupons.length === 0 ? "You have no Testkart coupons to use right now." : "None of your Testkart coupons fit this cart yet."}
                    </p>
                  )}

                  {others.length > 0 ? (
                    <>
                      <button type="button" className={styles.toggle} onClick={() => setShowOthers((v) => !v)} aria-expanded={showOthers}>
                        {showOthers ? "Hide" : "Show"} {others.length} coupon{others.length === 1 ? "" : "s"} that can't be used on this cart
                      </button>
                      {showOthers ? <ul className={styles.list}>{others.map(renderCoupon)}</ul> : null}
                    </>
                  ) : null}
                </section>
              </>
            )}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button variant="outline" className={styles.closeButton} onClick={() => setOpen(false)}>
              Close
            </Button>
          </ConsoleDialogFooter>
        </ConsoleDialogContent>
      </Dialog>
    </>
  );
};
