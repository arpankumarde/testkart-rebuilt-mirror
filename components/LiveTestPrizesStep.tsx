import React from 'react';
import { LiveTestFormValues } from '../helpers/liveTestCreationFormSchema';
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { Checkbox } from './Checkbox';
import { Button } from './Button';
import { Trophy, AlertTriangle, Plus, X } from 'lucide-react';
import {
  PrizeTier,
  getTotalPrizePool,
  validatePrizeTiers,
} from '../helpers/liveTestPrizeTiers';
import styles from './LiveTestPrizesStep.module.css';

const formatRupees = (amount: number): string => `₹${Math.round(amount).toLocaleString('en-IN')}`;

interface LiveTestPrizesStepProps {
  values: LiveTestFormValues;
  setValues: React.Dispatch<React.SetStateAction<LiveTestFormValues>>;
  // Locks the whole step. Used by the edit flow once a live test is published -
  // matches the update endpoint's server-side rule that price/prize fields can't
  // change after publish.
  disabled?: boolean;
}

export const LiveTestPrizesStep: React.FC<LiveTestPrizesStepProps> = ({ values, setValues, disabled = false }) => {
  const tiers = values.prizeTiers || [];
  const totalPrizePool = getTotalPrizePool(tiers);
  const validationError = tiers.length > 0 ? validatePrizeTiers(tiers) : null;

  const updateTiers = (next: PrizeTier[]) => {
    setValues((p) => ({ ...p, prizeTiers: next }));
  };

  const addTier = () => {
    const lastRankTo = tiers.reduce((max, t) => Math.max(max, t.rankTo), 0);
    const nextTier: PrizeTier = {
      rankFrom: lastRankTo + 1,
      rankTo: lastRankTo + 1,
      amountPerRank: 0,
    };
    updateTiers([...tiers, nextTier]);
  };

  const removeTier = (index: number) => {
    updateTiers(tiers.filter((_, i) => i !== index));
  };

  const patchTier = (index: number, patch: Partial<PrizeTier>) => {
    updateTiers(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  return (
    <>
      <FormItem name="hasPrizes">
        <div className={styles.checkboxRow}>
          <FormControl>
            <Checkbox
              id="hasPrizes-live"
              checked={values.hasPrizes || false}
              disabled={disabled}
              onChange={(e) => setValues((p) => ({ ...p, hasPrizes: e.target.checked }))}
            />
          </FormControl>
          <div className={styles.checkboxRowText}>
            <FormLabel htmlFor="hasPrizes-live">Offer Prize Money</FormLabel>
            <FormDescription>Enable this to offer cash prizes to top performers.</FormDescription>
          </div>
        </div>
        <FormMessage />
      </FormItem>

      {values.hasPrizes && (
        <>
          <FormItem name="prizeTiers">
            <FormLabel>Prize Ranks</FormLabel>
            <FormDescription>
              Set the prize amount each winner in a rank range receives. For example, rank 1 could get ₹500, while
              ranks 4-10 each get ₹100.
            </FormDescription>

            {tiers.length === 0 ? (
              <div className={styles.emptyState}>No rank ranges configured yet.</div>
            ) : (
              <div className={styles.tierList}>
                <div className={styles.tierHeaderRow}>
                  <span>From Rank</span>
                  <span>To Rank</span>
                  <span>Amount per Winner (₹)</span>
                  <span />
                </div>
                {tiers.map((tier, index) => (
                  <div className={styles.tierRow} key={index}>
                    <Input
                      type="number"
                      min={1}
                      value={tier.rankFrom || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        patchTier(index, { rankFrom: e.target.value === '' ? 0 : Number(e.target.value) })
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      value={tier.rankTo || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        patchTier(index, { rankTo: e.target.value === '' ? 0 : Number(e.target.value) })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      value={tier.amountPerRank || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        patchTier(index, { amountPerRank: e.target.value === '' ? 0 : Number(e.target.value) })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      aria-label="Remove rank range"
                      onClick={() => removeTier(index)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addTier} className={styles.addButton}>
              <Plus size={14} /> Add Rank Range
            </Button>

            <FormMessage />
          </FormItem>

          {tiers.length > 0 && (
            <div className={styles.totalRow}>
              <Trophy size={16} className={styles.iconFirst} />
              <span>Total Prize Pool (calculated): </span>
              <strong>{formatRupees(totalPrizePool)}</strong>
            </div>
          )}

          {validationError && (
            <div className={styles.warningBanner}>
              <AlertTriangle size={16} />
              <span>{validationError}</span>
            </div>
          )}
        </>
      )}
    </>
  );
};
