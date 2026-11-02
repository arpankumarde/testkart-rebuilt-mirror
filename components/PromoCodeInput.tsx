import React, { useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { useValidatePromoCodeMutation } from '../helpers/usePromoCodeMutations';
import { Loader, X, CheckCircle } from 'lucide-react';
import styles from './PromoCodeInput.module.css';

interface PromoCodeInputProps {
  items: Array<{ id: number; type: 'course' | 'test' | 'live_test' | 'bundle' | 'digital_product'; price: number }>;
  totalAmount: number;
  onApply: (promoCodeId: number, discountAmount: number, code: string, eligibleItemIds: number[], ineligibleItemIds: number[]) => void;
  onRemove: () => void;
  appliedDiscount?: { code: string; amount: number };
  /**
   * Replaces the promo-codes/validate check (and onApply) when the caller prices
   * the code itself, as the cart does with its stacked coupons. Resolves to an
   * error message, or null when the code was applied.
   */
  onSubmitCode?: (code: string) => Promise<string | null>;
  className?: string;
}

export const PromoCodeInput: React.FC<PromoCodeInputProps> = ({
  items,
  totalAmount,
  onApply,
  onRemove,
  appliedDiscount,
  onSubmitCode,
  className,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutate: validateCode, isPending } = useValidatePromoCodeMutation();

  const handleApply = () => {
    if (!code.trim()) {
      setError('Please enter a promo code.');
      return;
    }
    setError(null);

    if (onSubmitCode) {
      setIsSubmitting(true);
      onSubmitCode(code.trim())
        .then((message) => {
          if (message) setError(message);
          else setCode('');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'An unexpected error occurred.'))
        .finally(() => setIsSubmitting(false));
      return;
    }

    validateCode(
      { code, items, totalAmount },
      {
        onSuccess: (data) => {
          if (data.valid && data.promoCodeId && data.discountAmount) {
            onApply(
              data.promoCodeId, 
              data.discountAmount, 
              code,
              data.eligibleItemIds ?? [],
              data.ineligibleItemIds ?? []
            );
            setCode('');
          } else {
            setError(data.message);
          }
        },
        onError: (err) => {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('An unexpected error occurred.');
          }
        },
      }
    );
  };

  const handleRemove = () => {
    setError(null);
    onRemove();
  };

  const busy = isPending || isSubmitting;

  if (appliedDiscount) {
    return (
      <div className={`${styles.container} ${styles.appliedContainer} ${className || ''}`}>
        <div className={styles.appliedInfo}>
          <CheckCircle size={18} className={styles.successIcon} />
          <div>
            <span className={styles.appliedCode}>{appliedDiscount.code}</span>
            <span className={styles.appliedDiscount}>- ₹{appliedDiscount.amount.toFixed(2)}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={handleRemove} aria-label="Remove promo code">
          <X size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.inputWrapper}>
        <Input
          placeholder="Enter Promo Code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          className={styles.input}
        />
        <Button onClick={handleApply} disabled={busy} className={styles.applyButton}>
          {busy ? <Loader size={16} className={styles.spinner} /> : 'Apply'}
        </Button>
      </div>
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
};
