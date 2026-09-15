import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { FormItem, FormLabel, FormControl, FormMessage } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { useIfscLookup } from "../helpers/useIfscLookup";
import { isValidIfscFormat } from "../endpoints/ifsc-lookup_GET.schema";
import styles from "./BankIfscFields.module.css";

interface BankIfscFieldsProps {
  ifsc: string;
  bankName: string;
  onIfscChange: (ifsc: string) => void;
  onBankNameChange: (bankName: string) => void;
  disabled?: boolean;
}

/*
 * The IFSC field and the bank name it resolves to, shared by the student and
 * teacher bank-details forms so both behave identically.
 *
 * The bank name is not a question the user answers: it comes from the bank
 * directory and stays read-only. It only becomes editable if the lookup fails
 * and the user explicitly says they want to type it, which is also the only
 * way to file details for a branch the directory does not carry.
 *
 * Renders two FormItems as siblings so a parent laying its fields out in a
 * grid keeps them as direct grid children.
 */
export const BankIfscFields: React.FC<BankIfscFieldsProps> = ({
  ifsc,
  bankName,
  onIfscChange,
  onBankNameChange,
  disabled = false,
}) => {
  const [isManualEntry, setIsManualEntry] = useState(false);
  const { data, isFetching, error } = useIfscLookup(ifsc);

  const hasCompleteIfsc = isValidIfscFormat(ifsc);
  const resolvedBank = data?.bank ?? null;

  /* Mirror the resolved name into the form. Guarded on inequality so this
     settles after one pass instead of looping. */
  useEffect(() => {
    if (resolvedBank && resolvedBank !== bankName) {
      onBankNameChange(resolvedBank);
    }
  }, [resolvedBank, bankName, onBankNameChange]);

  /* Editing the code invalidates whatever it resolved to, so the name clears
     and the field re-locks. Only fires on real typing, so a form prefilled
     from saved details keeps its stored name while the lookup runs. */
  const handleIfscChange = (raw: string) => {
    const next = raw.toUpperCase();
    if (next !== ifsc) {
      setIsManualEntry(false);
      if (bankName) onBankNameChange("");
    }
    onIfscChange(next);
  };

  const lookupFailed = !!error && hasCompleteIfsc && !isFetching;
  const isBankNameLocked = !isManualEntry;

  const bankNamePlaceholder = isManualEntry
    ? "e.g. State Bank of India"
    : isFetching
      ? "Finding your bank..."
      : hasCompleteIfsc
        ? "Bank name appears here"
        : "Enter your IFSC code first";

  return (
    <>
      <FormItem name="bankIfscCode">
        <FormLabel>IFSC code</FormLabel>
        <FormControl>
          <Input
            placeholder="e.g. SBIN0001234"
            value={ifsc}
            onChange={(e) => handleIfscChange(e.target.value)}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            maxLength={11}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name="bankName">
        <FormLabel>Bank name</FormLabel>
        <FormControl>
          <Input
            placeholder={bankNamePlaceholder}
            value={bankName}
            onChange={(e) => onBankNameChange(e.target.value)}
            disabled={disabled}
            readOnly={isBankNameLocked}
            aria-readonly={isBankNameLocked}
            className={isBankNameLocked ? styles.lockedInput : undefined}
            autoComplete="off"
          />
        </FormControl>

        {isFetching && (
          <p className={styles.hint}>
            <Loader2 size={14} className={`${styles.hintIcon} ${styles.spin}`} />
            Looking up your bank...
          </p>
        )}

        {!isFetching && data && !isManualEntry && (
          <p className={`${styles.hint} ${styles.hintConfirmed}`}>
            <CheckCircle2 size={14} className={styles.hintIcon} />
            {[data.branch, data.city].filter(Boolean).join(", ") || "Matched from your IFSC code"}
          </p>
        )}

        {!isFetching && isManualEntry && (
          <p className={styles.hint}>
            You are entering the bank name yourself. Correcting the IFSC code will fetch it again.
          </p>
        )}

        {lookupFailed && !isManualEntry && (
          <div className={styles.warning} role="alert">
            <p className={styles.warningText}>
              <AlertTriangle size={15} />
              <span>
                {error.notFound
                  ? `No bank branch is registered against ${ifsc.trim().toUpperCase()}. Check the code for a typo.`
                  : "We could not reach the bank directory just now."}{" "}
                You can continue and type your bank name yourself.
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsManualEntry(true)}
              disabled={disabled}
            >
              Enter bank name myself
            </Button>
          </div>
        )}

        <FormMessage />
      </FormItem>
    </>
  );
};
