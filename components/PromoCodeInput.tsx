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
  className?: string;
}

export const PromoCodeInput: React.FC<PromoCodeInputProps> = ({
  items,
  totalAmount,
  onApply,
  onRemove,
  appliedDiscount,
  className,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutate: validateCode, isPending } = useValidatePromoCodeMutation();

  const handleApply = () => {
    if (!code.trim()) {
      setError('Please enter a promo code.');
      return;
    }
    setError(null);

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
        <Button onClick={handleApply} disabled={isPending} className={styles.applyButton}>
          {isPending ? <Loader size={16} className={styles.spinner} /> : 'Apply'}
        </Button>
      </div>
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
};