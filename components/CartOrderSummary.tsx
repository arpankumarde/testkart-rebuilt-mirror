import React, { useState } from "react";
import { Tag, Lock, ChevronDown, ChevronUp, CheckCircle, Wallet } from "lucide-react";
import { Button } from "./Button";
import { PromoCodeInput } from "./PromoCodeInput";
import styles from "./CartOrderSummary.module.css";

interface CartOrderSummaryProps {
  subtotal: number;
  itemDiscounts: number;
  promoDiscount: number;
  finalTotal: number;
  onProceed: () => void;
  isProcessing: boolean;
  promoInputProps: React.ComponentProps<typeof PromoCodeInput>;
  appliedPromoCode?: string;
  walletBalance?: number;
  onPayWithWallet?: () => void;
  isWalletProcessing?: boolean;
}

export const CartOrderSummary: React.FC<CartOrderSummaryProps> = ({
  subtotal,
  itemDiscounts,
  promoDiscount,
  finalTotal,
  onProceed,
  isProcessing,
  promoInputProps,
  appliedPromoCode,
  walletBalance,
  onPayWithWallet,
  isWalletProcessing,
}) => {
  const [isPromoOpen, setIsPromoOpen] = useState(false);

  // Formatter
  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);

  const discountPercentage = subtotal > 0 ? Math.round((itemDiscounts / subtotal) * 100) : 0;

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Order Summary</h2>
      
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Subtotal</span>
          <span className={styles.value}>{formatPrice(subtotal)}</span>
        </div>

        {itemDiscounts > 0 && (
          <div className={`${styles.row} ${styles.discountRow}`}>
            <span className={styles.label}>
              Discount <span className={styles.percentageBadge}>{discountPercentage}% OFF</span>
            </span>
            <span className={styles.discountValue}>-{formatPrice(itemDiscounts)}</span>
          </div>
        )}

        {promoDiscount > 0 && (
          <div className={`${styles.row} ${styles.promoRow}`}>
            <span className={styles.label}>
               Promo Code ({appliedPromoCode})
            </span>
            <span className={styles.promoValue}>-{formatPrice(promoDiscount)}</span>
          </div>
        )}

        <div className={styles.separator} />

        <div className={`${styles.row} ${styles.totalRow}`}>
          <span className={styles.totalLabel}>Total Amount</span>
          <span className={styles.totalValue}>{formatPrice(finalTotal)}</span>
        </div>
        
        <p className={styles.taxNote}>Inclusive of all taxes</p>
      </div>

      <div className={styles.promoSection}>
        {!appliedPromoCode ? (
          <button 
            className={styles.promoToggle}
            onClick={() => setIsPromoOpen(!isPromoOpen)}
            type="button"
          >
            <div className={styles.promoToggleLeft}>
              <Tag size={16} />
              <span>Have a Promo Code?</span>
            </div>
            {isPromoOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        ) : null}

        {(isPromoOpen || appliedPromoCode) && (
          <div className={styles.promoInputWrapper}>
            <PromoCodeInput {...promoInputProps} className={styles.promoInput} />
          </div>
        )}
      </div>

      {walletBalance !== undefined && walletBalance > 0 && (
        <div className={styles.walletSection}>
          <div className={styles.walletHeader}>
            <Wallet size={16} />
            <span>Wallet Balance: {formatPrice(walletBalance)}</span>
          </div>
          {walletBalance >= finalTotal ? (
            <Button
              size="lg"
              className={styles.walletButton}
              onClick={onPayWithWallet}
              disabled={isWalletProcessing || isProcessing}
            >
              {isWalletProcessing ? "Processing..." : (
                <>
                  <Wallet size={16} />
                  Pay with Wallet
                </>
              )}
            </Button>
          ) : (
            <div className={styles.insufficientBalance}>
              Insufficient balance for full payment
            </div>
          )}
        </div>
      )}

      <Button
        size="lg"
        className={styles.checkoutButton}
        onClick={onProceed}
        disabled={isProcessing}
      >
        {isProcessing ? "Processing..." : finalTotal === 0 ? (
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

      {finalTotal > 0 && (
        <div className={styles.securityNote}>
          <Lock size={12} />
          <span>Secure Transaction</span>
        </div>
      )}
    </div>
  );
};