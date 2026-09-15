import React, { useState } from "react";
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
    .min(100, "Minimum withdrawal amount is ₹100")
    .positive("Amount must be positive"),
  notes: z.string().optional(),
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
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: undefined,
      notes: "",
    },
  });

  const onSubmit = (data: WithdrawalFormValues) => {
    if (data.amount > availableBalance) {
      toast.error("Withdrawal amount cannot exceed available balance");
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
          <DialogTitle>Request Withdrawal</DialogTitle>
          <DialogDescription>
            Enter the amount you wish to withdraw. The minimum amount is ₹100.
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
              placeholder="Enter amount"
              {...register("amount")}
              className={errors.amount ? styles.inputError : ""}
            />
            {errors.amount && (
              <span className={styles.errorText}>{errors.amount.message}</span>
            )}
            <div className={styles.balanceHint}>
              Available Balance: <strong>₹{availableBalance.toFixed(2)}</strong>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="notes" className={styles.label}>
              Notes (Optional)
            </label>
            <Input
              id="notes"
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