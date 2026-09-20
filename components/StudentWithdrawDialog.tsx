import React, { useEffect, useState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "./Dialog";
import {
  ConsoleDialogBody,
  ConsoleDialogContent,
  ConsoleDialogFooter,
  ConsoleDialogHeader,
} from "./ConsoleDialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { useRequestStudentWithdrawal } from "../helpers/useStudentWithdrawals";
import styles from "./StudentWithdrawDialog.module.css";

export const STUDENT_MIN_WITHDRAWAL = 50;

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface StudentWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
}

/* Opens on the whole balance, which is what most students take out. */
export const StudentWithdrawDialog: React.FC<StudentWithdrawDialogProps> = ({
  open,
  onOpenChange,
  availableBalance,
}) => {
  const { mutateAsync: requestWithdrawal, isPending } = useRequestStudentWithdrawal();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(availableBalance.toFixed(2));
    setNotes("");
    setError(null);
  }, [open, availableBalance]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError("Enter the amount to withdraw.");
      return;
    }
    if (value < STUDENT_MIN_WITHDRAWAL) {
      setError(`The smallest withdrawal is ${rupees.format(STUDENT_MIN_WITHDRAWAL)}.`);
      return;
    }
    if (value > availableBalance) {
      setError(`You can withdraw up to ${rupees.format(availableBalance)}.`);
      return;
    }

    try {
      await requestWithdrawal({
        amount: Math.round(value * 100) / 100,
        notes: notes.trim() || undefined,
      });
      toast.success(`Withdrawal of ${rupees.format(value)} requested.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not request the withdrawal. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <ConsoleDialogContent size="sm">
        <form onSubmit={handleSubmit} noValidate>
          <ConsoleDialogHeader
            title="Withdraw prize money"
            description="It is paid to your verified bank account once our team processes it."
            hideClose={isPending}
          />

          <ConsoleDialogBody className={styles.body}>
            <div className={styles.field}>
              <label htmlFor="student-withdraw-amount" className={styles.label}>
                Amount
              </label>
              <div className={styles.amountInput}>
                <span className={styles.currency} aria-hidden="true">₹</span>
                <Input
                  id="student-withdraw-amount"
                  type="number"
                  inputMode="decimal"
                  min={STUDENT_MIN_WITHDRAWAL}
                  max={availableBalance}
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  aria-invalid={!!error}
                  aria-describedby="student-withdraw-hint"
                  disabled={isPending}
                  className={error ? styles.inputError : undefined}
                />
              </div>
              {error ? (
                <p id="student-withdraw-hint" className={styles.error} role="alert">{error}</p>
              ) : (
                <p id="student-withdraw-hint" className={styles.hint}>
                  {rupees.format(STUDENT_MIN_WITHDRAWAL)} to {rupees.format(availableBalance)}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="student-withdraw-notes" className={styles.label}>
                Note for our team (optional)
              </label>
              <Input
                id="student-withdraw-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
              />
            </div>
          </ConsoleDialogBody>

          <ConsoleDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 size={16} className={styles.spinner} aria-hidden="true" /> : <Banknote size={16} aria-hidden="true" />}
              {isPending ? "Requesting..." : "Request withdrawal"}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};