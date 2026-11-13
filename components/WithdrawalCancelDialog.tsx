import React from "react";
import { Undo2 } from "lucide-react";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";

interface WithdrawalCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: () => void;
}

/* The confirmation before a student or teacher cancels their own pending withdrawal request. */
export const WithdrawalCancelDialog: React.FC<WithdrawalCancelDialogProps> = ({ open, onOpenChange, isPending, onConfirm }) => (
  <ConsoleConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Cancel Withdrawal Request?"
    description="Are you sure you want to cancel this withdrawal request? The amount will be returned to your available wallet balance."
    tone="destructive"
    icon={<Undo2 size={20} />}
    cancelLabel="Keep Request"
    confirmLabel="Yes, Cancel Request"
    pendingLabel="Cancelling..."
    isPending={isPending}
    onConfirm={onConfirm}
  />
);