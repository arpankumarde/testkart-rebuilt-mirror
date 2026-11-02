import React, { useId, useState } from "react";
import { Tag, Lock, ChevronDown, CheckCircle, Wallet, ReceiptText, PiggyBank, Loader } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { PromoCodeInput } from "./PromoCodeInput";
import { formatOfferInr } from "../helpers/courseCouponOffer";
import type { CartItemPricing } from "../helpers/cartItemPricing";
import styles from "./CartOrderSummary.module.css";

export type CartTotals = {
  /** Sum of list prices (MRP). */
  totalMrp: number;
  /** Items' own price drops (sale prices). */
  saleDiscount: number;
  /** Automatic teacher offers, from the cart quote. */
  teacherDiscount: number;
  /** The one coupon the student chose, from the cart quote. */
  couponDiscount: number;
  couponCode?: string;
  tcoinsUsed: number;
  tcoinsValue: number;
  /** What checkout will charge. */
  finalTotal: number;
};

interface CartOrderSummaryProps {
  items: CartItemPricing[];
  totals: CartTotals;
  /** True until the server has priced the cart's coupons; checkout waits for it. */
  isPricing: boolean;
  onProceed: () => void;
  isProcessing: boolean;
  promoInputProps: React.ComponentProps<typeof PromoCodeInput>;
  hasTeacherOffers: boolean;
  /** The one coupon the student chose; while set, the code box shows it with a remove button. */
  chosenCoupon?: { code: string; amount: number };
  /** Explains a teacher offer that is not applied (Tcoins or a teacher code replaced it). */
  offerNote?: string;
  walletBalance?: number;
  onPayWithWallet?: () => void;
  isWalletProcessing?: boolean;
  /** Opens the list of teacher offers and Testkart coupons for this cart. */
  couponPicker?: React.ReactNode;
  tcoinsOption?: React.ReactNode;
  /** Why checkout cannot go ahead right now, e.g. an expired item in the cart; disables both pay buttons. */
  blockedReason?: string;
}

const minus = (amount: number) => `-${formatOfferInr(amount)}`;

export const CartOrderSummary: React.FC<CartOrderSummaryProps> = ({
  items,
  totals,
  isPricing,
  onProceed,
  isProcessing,
  promoInputProps,
  hasTeacherOffers,
  chosenCoupon,
  offerNote,
  walletBalance,
  onPayWithWallet,
  isWalletProcessing,
  couponPicker,
  tcoinsOption,
  blockedReason,
}) => {
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const breakdownId = useId();

  const savings = Math.max(0, Math.round((totals.totalMrp - totals.finalTotal) * 100) / 100);
  const itemCount = items.length;

  return (
    <section className={styles.container} aria-labelledby={`${breakdownId}-title`}>
      <div className={styles.head}>
        <h2 id={`${breakdownId}-title`} className={styles.title}>Order Summary</h2>
        <span className={styles.count}>
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className={styles.breakdown}>
        <button
          type="button"
          className={styles.breakdownToggle}
          onClick={() => setIsBreakdownOpen((open) => !open)}
          aria-expanded={isBreakdownOpen}
          aria-controls={breakdownId}
        >
          <span className={styles.breakdownToggleLabel}>
            <ReceiptText size={16} aria-hidden="true" />
            Price breakdown by item
          </span>
          <ChevronDown size={16} className={`${styles.chevron} ${isBreakdownOpen ? styles.chevronOpen : ""}`} aria-hidden="true" />
        </button>
        <div id={breakdownId} className={`${styles.collapse} ${isBreakdownOpen ? styles.collapseOpen : ""}`} aria-hidden={!isBreakdownOpen}>
          <div className={styles.collapseInner}>
            <ul className={styles.itemList}>
              {items.map((item) => (
                <li key={item.key} className={styles.itemBlock}>
                  <p className={styles.itemTitle} title={item.title}>{item.title}</p>
                  <dl className={styles.itemRows}>
                    <div className={styles.itemRow}>
                      <dt>Original price</dt>
                      <dd>{formatOfferInr(item.mrp)}</dd>
                    </div>
                    {item.saleDiscount > 0 ? (
                      <div className={`${styles.itemRow} ${styles.saving}`}>
                        <dt>Price discount</dt>
                        <dd>{minus(item.saleDiscount)}</dd>
                      </div>
                    ) : null}
                    {item.teacherDiscount > 0 ? (
                      <div className={`${styles.itemRow} ${styles.saving}`}>
                        <dt>Teacher discount{item.teacherCode ? ` (${item.teacherCode})` : ""}</dt>
                        <dd>{minus(item.teacherDiscount)}</dd>
                      </div>
                    ) : null}
                    <div className={`${styles.itemRow} ${styles.itemFinal}`}>
                      <dt>Final product price</dt>
                      <dd>{formatOfferInr(item.finalPrice)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Total MRP</dt>
          <dd>{formatOfferInr(totals.totalMrp)}</dd>
        </div>
        {totals.saleDiscount > 0 ? (
          <div className={`${styles.row} ${styles.saving}`}>
            <dt>Price discounts</dt>
            <dd>{minus(totals.saleDiscount)}</dd>
          </div>
        ) : null}
        {totals.teacherDiscount > 0 ? (
          <div className={`${styles.row} ${styles.saving}`}>
            <dt>Teacher discounts</dt>
            <dd>{minus(totals.teacherDiscount)}</dd>
          </div>
        ) : null}
        {totals.couponDiscount > 0 ? (
          <div className={`${styles.row} ${styles.saving}`}>
            <dt>
              Coupon{totals.couponCode ? <span className={styles.code}>{totals.couponCode}</span> : null}
            </dt>
            <dd>{minus(totals.couponDiscount)}</dd>
          </div>
        ) : null}
        {totals.tcoinsUsed > 0 ? (
          <div className={`${styles.row} ${styles.saving}`}>
            <dt>Tcoins ({totals.tcoinsUsed.toLocaleString("en-IN")})</dt>
            <dd>{minus(totals.tcoinsValue)}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.payable}>
        <div className={styles.payableRow}>
          <span className={styles.payableLabel}>Final payable amount</span>
          {isPricing ? (
            <Skeleton style={{ width: "6rem", height: "1.75rem" }} />
          ) : (
            <span className={styles.payableValue}>{formatOfferInr(totals.finalTotal)}</span>
          )}
        </div>
        <p className={styles.taxNote}>Inclusive of all taxes</p>
      </div>

      {!isPricing && savings > 0 ? (
        <p className={styles.savingsNote}>
          <PiggyBank size={16} aria-hidden="true" />
          You save {formatOfferInr(savings)} on this order!
        </p>
      ) : null}

      <div className={styles.promoSection}>
        {offerNote ? <p className={styles.offerNote}>{offerNote}</p> : null}

        {!chosenCoupon ? (
          <button
            className={styles.promoToggle}
            onClick={() => setIsPromoOpen(!isPromoOpen)}
            type="button"
            aria-expanded={isPromoOpen}
          >
            <span className={styles.promoToggleLeft}>
              <Tag size={16} aria-hidden="true" />
              {hasTeacherOffers ? "Have another coupon?" : "Have a coupon?"}
            </span>
            <ChevronDown size={16} className={`${styles.chevron} ${isPromoOpen ? styles.chevronOpen : ""}`} aria-hidden="true" />
          </button>
        ) : null}

        {(isPromoOpen || chosenCoupon) && (
          <div className={styles.promoInputWrapper}>
            <PromoCodeInput {...promoInputProps} className={styles.promoInput} />
          </div>
        )}

        {couponPicker ? <div className={styles.pickerRow}>{couponPicker}</div> : null}
      </div>

      {tcoinsOption ? <div className={styles.tcoinsRow}>{tcoinsOption}</div> : null}

      {walletBalance !== undefined && walletBalance > 0 && (
        <div className={styles.walletSection}>
          <div className={styles.walletHeader}>
            <Wallet size={16} aria-hidden="true" />
            <span>Wallet balance: {formatOfferInr(walletBalance)}</span>
          </div>
          {walletBalance >= totals.finalTotal ? (
            <Button
              size="lg"
              variant="outline"
              className={`${styles.walletButton} ${styles.secondaryButton}`}
              onClick={onPayWithWallet}
              disabled={isWalletProcessing || isProcessing || isPricing || !!blockedReason}
            >
              {isWalletProcessing ? "Processing..." : (
                <>
                  <Wallet size={16} />
                  Pay with Wallet
                </>
              )}
            </Button>
          ) : (
            <p className={styles.insufficientBalance}>Insufficient balance for full payment</p>
          )}
        </div>
      )}

      {blockedReason ? (
        <p className={styles.blockedNote} role="alert">
          {blockedReason}
        </p>
      ) : null}

      <Button
        size="lg"
        className={`${styles.checkoutButton} ${styles.ctaButton}`}
        onClick={onProceed}
        disabled={isProcessing || isPricing || !!blockedReason}
      >
        {isProcessing ? (
          <>
            <Loader size={16} className={styles.spinner} aria-hidden="true" />
            Processing...
          </>
        ) : totals.finalTotal === 0 && !isPricing ? (
          <>
            <CheckCircle size={16} />
            Complete Order (Free)
          </>
        ) : (
          <>
            <Lock size={16} />
            Proceed to Payment
          </>
        )}
      </Button>

      {totals.finalTotal > 0 && (
        <p className={styles.securityNote}>
          <Lock size={12} aria-hidden="true" />
          Secure Transaction
        </p>
      )}
    </section>
  );
};
