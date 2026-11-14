import React from "react";
import { Input } from "./Input";
import { Switch } from "./Switch";
import { trialPriceFrom } from "../helpers/livePricing";
import {
  KEY_MINUTES,
  KEY_NAME,
  PRICE_KEYS,
  priceFieldErrors,
  type PriceDraft,
  type PriceKey,
  type PriceRules,
} from "../helpers/liveTeachingForms";
import { FieldError } from "./LiveField";
import field from "./LiveField.module.css";
import styles from "./LivePriceEditor.module.css";

/*
 * Class prices for the short and full session, the trial each gives, and the
 * trial discount switch. Controlled: the caller owns the draft and saving.
 * Errors show for a field once it was edited or once showErrors is set.
 */
export const LivePriceEditor: React.FC<{
  value: PriceDraft;
  onChange: (next: PriceDraft) => void;
  rules: PriceRules;
  showErrors: boolean;
  idPrefix: string;
}> = ({ value, onChange, rules, showErrors, idPrefix }) => {
  const [touched, setTouched] = React.useState<Record<PriceKey, boolean>>({ classShort: false, classFull: false });
  const errors = priceFieldErrors(value, rules);

  return (
    <div className={styles.editor}>
      <div className={styles.tiles} role="group" aria-label="Price per class">
        {PRICE_KEYS.map((key) => {
          const error = showErrors || touched[key] ? errors[key] : null;
          const amount = Number(value[key]);
          const trial = errors[key] ? null : trialPriceFrom(amount, KEY_MINUTES[key], value.trialDiscount);
          const inputId = `${idPrefix}-${key}`;
          return (
            <div key={key} className={styles.tile} data-kind={key}>
              <div className={styles.tileHead}>
                <span className={styles.tileName}>{KEY_NAME[key]}</span>
                <span className={styles.tileMins}>{KEY_MINUTES[key]} min</span>
              </div>
              <label className={styles.tileLabel} htmlFor={inputId}>
                Class price
              </label>
              <div className={styles.money}>
                <span className={styles.moneyPrefix} aria-hidden="true">
                  ₹
                </span>
                <Input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={rules.min[key]}
                  step={1}
                  value={value[key]}
                  onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
                  className={`${field.input} ${styles.moneyInput}`}
                  aria-invalid={!!error || undefined}
                  aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
                />
              </div>
              <p className={styles.tileHint} id={`${inputId}-hint`}>
                Minimum ₹{rules.min[key]}. Same price in a package or on its own.
              </p>
              <FieldError id={`${inputId}-error`} message={error} />
              <div className={styles.trialRow}>
                <span className={styles.trialLabel}>Trial class</span>
                <span className={styles.trialPrice}>{trial === null ? "-" : `₹${trial.toLocaleString("en-IN")}`}</span>
                <span className={styles.trialNote}>
                  {value.trialDiscount ? `${rules.discountPercent[key]}% off` : "Full price"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={field.switchRow}>
        <div className={field.switchText}>
          <span className={field.switchLabel} id={`${idPrefix}-discount-label`}>
            Discount the trial class
          </span>
          <span className={field.switchHint}>
            {rules.discountPercent.classShort}% off a short session trial, {rules.discountPercent.classFull}% off a full
            session trial. A cheaper first class brings more students.
          </span>
        </div>
        <Switch
          checked={value.trialDiscount}
          onCheckedChange={(checked) => onChange({ ...value, trialDiscount: checked })}
          aria-labelledby={`${idPrefix}-discount-label`}
        />
      </div>
    </div>
  );
};