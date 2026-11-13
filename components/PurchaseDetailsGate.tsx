import React, { ReactNode, useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useAuth } from "../helpers/useAuth";
import { BILLING_DETAILS_QUERY_KEY, useUpdateBillingStateMutation } from "../helpers/useBillingDetails";
import { getBillingDetails } from "../endpoints/account/billing-details_GET.schema";
import { useStudentProfileMutations } from "../helpers/useStudentProfileMutations";
import { INDIAN_STATES, isIndianState } from "../helpers/indianLocationsData";
import { displayNameProblem, isPlaceholderDisplayName } from "../helpers/isPlaceholderDisplayName";
import { PurchaseDetailsGateContext } from "../helpers/usePurchaseDetailsGate";
import styles from "./PurchaseDetailsGate.module.css";

type Needs = { name: boolean; state: boolean };

/**
 * Supplies usePurchaseDetailsGate. Before any paid checkout starts, a student
 * still on a generated User_ name or with no billing state saved gets one
 * popup asking only for what is missing. Students who already have both never
 * see it.
 */
export const PurchaseDetailsGateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const authRef = useRef(authState);
  authRef.current = authState;
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [needs, setNeeds] = useState<Needs | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setNeeds(null);
  }, []);

  const ensure = useCallback(async () => {
    const auth = authRef.current;
    if (auth.type !== "authenticated" || auth.user.role !== "student" || auth.impersonatorAdminId) return true;

    const name = isPlaceholderDisplayName(auth.user.displayName);
    let state = false;
    try {
      const data = await queryClient.fetchQuery({
        queryKey: BILLING_DETAILS_QUERY_KEY,
        queryFn: () => getBillingDetails(),
      });
      state = !isIndianState(data?.billingDetails?.state);
    } catch {
      // A failed read never blocks a payment; the dashboard gate asks again later.
      state = false;
    }
    if (!name && !state) return true;

    resolveRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setNeeds({ name, state });
    });
  }, [queryClient]);

  return (
    <PurchaseDetailsGateContext.Provider value={ensure}>
      {children}
      {needs && <PurchaseDetailsDialog needs={needs} onDone={() => finish(true)} onCancel={() => finish(false)} />}
    </PurchaseDetailsGateContext.Provider>
  );
};

const PurchaseDetailsDialog: React.FC<{ needs: Needs; onDone: () => void; onCancel: () => void }> = ({
  needs,
  onDone,
  onCancel,
}) => {
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { useUpdateStudentProfileMutation } = useStudentProfileMutations();
  const profileMutation = useUpdateStudentProfileMutation();
  const stateMutation = useUpdateBillingStateMutation();

  const askName = needs.name && !nameSaved;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const pickedState = isIndianState(state) ? state : null;
    const nextNameError = askName ? displayNameProblem(name) : null;
    const nextStateError = needs.state && !pickedState ? "Please select your state." : null;
    setNameError(nextNameError);
    setStateError(nextStateError);
    setFormError(null);
    if (nextNameError || nextStateError) return;

    setIsSaving(true);
    try {
      if (askName) {
        await profileMutation.mutateAsync({ displayName: name.trim() });
        setNameSaved(true);
      }
      if (needs.state && pickedState) {
        await stateMutation.mutateAsync({ state: pickedState });
      }
      onDone();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const title =
    needs.name && needs.state ? "Add your name and state" : needs.name ? "Add your full name" : "Select your state";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onCancel();
      }}
    >
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>These go on your invoice. You only need to add them once.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {formError && <p className={styles.formError}>{formError}</p>}

          {askName && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="purchase-full-name">
                Full name <span className={styles.requiredTag}>*</span>
              </label>
              <Input
                id="purchase-full-name"
                placeholder="Enter your full name"
                autoComplete="name"
                autoFocus
                value={name}
                disabled={isSaving}
                aria-invalid={nameError ? true : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
              />
              {nameError && <p className={styles.errorText}>{nameError}</p>}
            </div>
          )}

          {needs.state && (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="purchase-billing-state">
                  State <span className={styles.requiredTag}>*</span>
                </label>
                <Select
                  value={state || undefined}
                  onValueChange={(next) => {
                    setState(next);
                    setStateError(null);
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger id="purchase-billing-state" aria-invalid={stateError ? true : undefined}>
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
                {stateError && <p className={styles.errorText}>{stateError}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="purchase-billing-country">
                  Country
                </label>
                <Input id="purchase-billing-country" value="India" readOnly disabled />
              </div>
            </>
          )}

          <Button type="submit" disabled={isSaving} className={styles.submitButton}>
            {isSaving ? (
              <span className={styles.loadingText}>
                <Spinner className={styles.spinner} size="sm" />
                Saving...
              </span>
            ) : (
              "Continue to payment"
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving} className={styles.cancelButton}>
            Cancel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
