import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useAuth } from "../helpers/useAuth";
import { useUpdateBillingStateMutation } from "../helpers/useBillingDetails";
import { INDIAN_STATES, isIndianState } from "../helpers/indianLocationsData";
import styles from "./RequiredBillingStateDialog.module.css";

/**
 * Blocking popup for students and teachers with no billing state saved. It
 * cannot be closed or skipped; saving refreshes the billing details query,
 * which unlocks the dashboard on its own. The only way out is to log out.
 */
export const RequiredBillingStateDialog: React.FC = () => {
  const { logout } = useAuth();
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const updateMutation = useUpdateBillingStateMutation();
  const isSaving = updateMutation.isPending;

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isIndianState(state)) {
      setError("Please select your state.");
      return;
    }
    setError(null);
    updateMutation.mutate({ state }, { onError: (err) => setError(err.message) });
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className={styles.dialogContent}
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Select your billing state</DialogTitle>
          <DialogDescription>
            We need the state you are billed from to issue correct GST invoices. Select it to
            open your dashboard. You can add your full address later in Billing Details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="billing-state-select">
              State <span className={styles.requiredTag}>*</span>
            </label>
            <Select
              value={state || undefined}
              onValueChange={(next) => {
                setState(next);
                setError(null);
              }}
              disabled={isSaving}
            >
              <SelectTrigger id="billing-state-select" aria-invalid={error ? true : undefined}>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className={styles.errorText}>{error}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="billing-country">
              Country
            </label>
            <Input id="billing-country" value="India" readOnly disabled />
          </div>

          <Button type="submit" disabled={isSaving} className={styles.submitButton}>
            {isSaving ? (
              <span className={styles.loadingText}>
                <Spinner className={styles.spinner} size="sm" />
                Saving...
              </span>
            ) : (
              "Save and Continue"
            )}
          </Button>
        </form>

        <div className={styles.footer}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => logout()}
            disabled={isSaving}
            className={styles.logoutButton}
          >
            Log out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};