import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { useRequestWithdrawal } from "../helpers/useTeacherWithdrawalQuery";
import { Loader2 } from "lucide-react";
import styles from "./WithdrawalRequestDialog.module.css";

const withdrawalSchema = z.object({
  amount: z.coerce
    .number()
    .finite()
    .min(100, "Minimum withdrawal amount is ₹100")
    .max(1_000_000, "Maximum withdrawal amount is ₹10,00,000")
    .multipleOf(0.01, "Amount can have at most two decimal places"),
  notes: z.string().max(500, "Notes can be at most 500 characters").optional(),
});

type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

interface WithdrawalRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
}

export const WithdrawalRequestDialog: React.FC<WithdrawalRequestDialogProps> = ({
  open,
  onOpenChange,
  availableBalance,
}) => {
  const { mutate: requestWithdrawal, isPending } = useRequestWithdrawal();
  // Most teachers withdraw everything, so the full balance is filled in.
  const fullBalance = Math.floor(availableBalance * 100) / 100;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: fullBalance >= 100 ? fullBalance : undefined,
      notes: "",
    },
  });

  useEffect(() => {
    if (open && fullBalance >= 100) setValue("amount", fullBalance);
  }, [open, fullBalance, setValue]);

  const onSubmit = (data: WithdrawalFormValues) => {
    if (data.amount > availableBalance) {
      setError("amount", { message: `You can withdraw up to ₹${fullBalance.toFixed(2)}.` });
      return;
    }

    requestWithdrawal(
      {
        amount: data.amount,
        notes: data.notes,
      },
      {
        onSuccess: () => {
          toast.success("Withdrawal request submitted successfully");
          reset();
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(`Failed to submit request: ${error.message}`);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Withdraw to your bank</DialogTitle>
          <DialogDescription>
            Your full available balance is filled in. Change it to withdraw less; the minimum is ₹100.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              Amount (₹)
            </label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="Enter amount"
              {...register("amount")}
              className={errors.amount ? styles.inputError : ""}
            />
            {errors.amount && (
              <span className={styles.errorText}>{errors.amount.message}</span>
            )}
            <div className={styles.balanceHint}>
              Available Balance: <strong>₹{availableBalance.toFixed(2)}</strong>
              {fullBalance >= 100 && (
                <button type="button" className={styles.allButton} onClick={() => setValue("amount", fullBalance, { shouldValidate: true })}>
                  Withdraw all
                </button>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="notes" className={styles.label}>
              Notes (Optional)
            </label>
            <Input
              id="notes"
              maxLength={500}
              placeholder="Any specific instructions..."
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className={styles.spinner} size={16} />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};